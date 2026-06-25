package com.falai.financas.billing

import android.app.Activity
import android.content.Context
import android.util.Log
import com.android.billingclient.api.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * BillingManager — Google Play Billing Library v6/v7 para assinaturas.
 *
 * SKUs (Base Plan IDs) configurados no Play Console:
 *   - premium_mensal  -> R$ 39,90/mês
 *   - familia_mensal  -> R$ 69,90/mês
 *
 * Fluxo correto:
 *   1. startConnection()
 *   2. queryProductDetails()  (carrega ProductDetails — antigo SkuDetails)
 *   3. launchPurchase(activity, productId)  -> BillingClient.launchBillingFlow()
 *   4. onPurchasesUpdated() -> acknowledgePurchase() + envia purchaseToken pro backend
 *
 * NUNCA use queryPurchases() para INICIAR uma compra — ele só LÊ as compras
 * existentes (é o que provoca "Não foi possível encontrar sua assinatura").
 */
class BillingManager(
    context: Context,
    private val onPurchaseVerified: (purchaseToken: String, productId: String) -> Unit,
) : PurchasesUpdatedListener {

    companion object {
        private const val TAG = "BillingManager"
        const val PRODUCT_PREMIUM = "premium_mensal"
        const val PRODUCT_FAMILIA = "familia_mensal"
        val ALL_PRODUCTS = listOf(PRODUCT_PREMIUM, PRODUCT_FAMILIA)
    }

    private val billingClient: BillingClient = BillingClient.newBuilder(context)
        .setListener(this)
        .enablePendingPurchases()
        .build()

    private val _productDetails = MutableStateFlow<Map<String, ProductDetails>>(emptyMap())
    val productDetails: StateFlow<Map<String, ProductDetails>> = _productDetails

    fun startConnection(onReady: () -> Unit = {}) {
        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    Log.d(TAG, "Billing conectado")
                    queryProductDetails(onReady)
                } else {
                    Log.e(TAG, "Falha ao conectar: ${result.debugMessage}")
                }
            }
            override fun onBillingServiceDisconnected() {
                Log.w(TAG, "Billing desconectado — tentar reconectar sob demanda")
            }
        })
    }

    private fun queryProductDetails(onReady: () -> Unit) {
        val products = ALL_PRODUCTS.map { id ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(id)
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        }
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(products)
            .build()

        billingClient.queryProductDetailsAsync(params) { result, list ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                _productDetails.value = list.associateBy { it.productId }
                Log.d(TAG, "Produtos carregados: ${list.map { it.productId }}")
                onReady()
            } else {
                Log.e(TAG, "queryProductDetails falhou: ${result.debugMessage}")
            }
        }
    }

    /**
     * Inicia o fluxo NATIVO de pagamento do Google Play.
     * Use no clique de "Assinar Premium" / "Assinar Família".
     */
    fun launchPurchase(activity: Activity, productId: String): Boolean {
        val details = _productDetails.value[productId] ?: run {
            Log.e(TAG, "ProductDetails não carregado para $productId — chame queryProductDetails antes")
            return false
        }
        val offerToken = details.subscriptionOfferDetails?.firstOrNull()?.offerToken ?: run {
            Log.e(TAG, "Nenhum offerToken para $productId")
            return false
        }

        val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(details)
            .setOfferToken(offerToken)
            .build()

        val flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(productParams))
            .build()

        val result = billingClient.launchBillingFlow(activity, flowParams)
        Log.d(TAG, "launchBillingFlow($productId) -> ${result.responseCode}")
        return result.responseCode == BillingClient.BillingResponseCode.OK
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> purchases?.forEach { handlePurchase(it) }
            BillingClient.BillingResponseCode.USER_CANCELED -> Log.i(TAG, "Compra cancelada pelo usuário")
            else -> Log.e(TAG, "Erro na compra: ${result.debugMessage}")
        }
    }

    private fun handlePurchase(purchase: Purchase) {
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) return
        val productId = purchase.products.firstOrNull() ?: return

        // Envia o token pro backend (verifyMyPlayPurchase) antes/depois do acknowledge.
        onPurchaseVerified(purchase.purchaseToken, productId)

        if (!purchase.isAcknowledged) {
            val params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchase.purchaseToken)
                .build()
            billingClient.acknowledgePurchase(params) { ack ->
                Log.d(TAG, "acknowledgePurchase: ${ack.responseCode}")
            }
        }
    }

    /** Use só para listar compras existentes (restaurar). NÃO use para INICIAR compra. */
    fun queryExistingSubscriptions(onResult: (List<Purchase>) -> Unit) {
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        billingClient.queryPurchasesAsync(params) { _, list -> onResult(list) }
    }

    fun endConnection() = billingClient.endConnection()
}
