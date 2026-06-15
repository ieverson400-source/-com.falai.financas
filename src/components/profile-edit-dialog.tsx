import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Camera, KeyRound, Loader2, User as UserIcon } from "lucide-react";

export function ProfileEditDialog({
  userId,
  email,
  currentAvatarUrl,
  onAvatarChange,
}: {
  userId: string;
  email: string | null | undefined;
  currentAvatarUrl: string | null | undefined;
  onAvatarChange?: (url: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const handlePickFile = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }
    // Bucket is private — store the storage path, render via short-lived signed URLs.
    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60);
    const displayUrl = signed?.signedUrl ?? null;

    const { error: profErr } = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("user_id", userId);
    if (profErr) {
      setUploading(false);
      toast.error(profErr.message);
      return;
    }
    await supabase.auth.updateUser({ data: { avatar_path: path } });
    setAvatarUrl(displayUrl);
    onAvatarChange?.(displayUrl);
    setUploading(false);
    toast.success("Foto atualizada!");
  };

  const handleChangePassword = async () => {
    if (pwd.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (pwd !== pwd2) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSavingPwd(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPwd("");
    setPwd2("");
    toast.success("Senha alterada com sucesso!");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors">
          <UserIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium flex-1">Editar perfil</span>
          <span className="text-xs text-muted-foreground">Foto e senha</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
          <DialogDescription>Atualize sua foto e senha de acesso.</DialogDescription>
        </DialogHeader>

        {/* Avatar */}
        <div className="flex items-center gap-4 py-2">
          <div className="relative">
            <div className="size-20 rounded-full bg-gradient-hero flex items-center justify-center text-primary-foreground font-display font-bold text-2xl overflow-hidden shadow-soft">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Sua foto de perfil" className="size-full object-cover" />
              ) : (
                (email ?? "?").slice(0, 1).toUpperCase()
              )}
            </div>
            <button
              type="button"
              onClick={handlePickFile}
              disabled={uploading}
              aria-label="Trocar foto"
              className="absolute -bottom-1 -right-1 size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-elevated hover:opacity-90 disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{email}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              JPG ou PNG, até 5MB.
            </p>
          </div>
        </div>

        {/* Password */}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Alterar senha</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pwd" className="text-xs">Nova senha</Label>
            <Input
              id="new-pwd"
              type="password"
              autoComplete="new-password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pwd" className="text-xs">Confirmar nova senha</Label>
            <Input
              id="confirm-pwd"
              type="password"
              autoComplete="new-password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              placeholder="Repita a nova senha"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <Button onClick={handleChangePassword} disabled={savingPwd || !pwd}>
            {savingPwd && <Loader2 className="size-4 animate-spin" />}
            Salvar senha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
