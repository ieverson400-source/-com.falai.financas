import { PluggyConnect } from "react-pluggy-connect";
export default function PluggyConnectWidget({ token, itemId, onSuccess, onClose, onError }: { token: string; itemId?: string; onSuccess: (itemId: string) => void; onClose: () => void; onError: () => void }) {
  return <PluggyConnect connectToken={token} updateItem={itemId} includeSandbox={false} onSuccess={(data) => onSuccess(data.item.id)} onClose={onClose} onError={onError} />;
}