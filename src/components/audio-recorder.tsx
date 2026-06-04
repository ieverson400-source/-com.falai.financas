import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, Upload } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { transcribeExpense } from "@/lib/transcribe.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onSuccess: () => void;
}

export function AudioRecorder({ onSuccess }: Props) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcribeFn = useServerFn(transcribeExpense);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processBlob(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      toast.error("Permita acesso ao microfone para gravar.");
    }
  };

  const stop = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const processBlob = async (blob: Blob) => {
    setProcessing(true);
    try {
      const buf = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada");

      const result = await transcribeFn({
        data: { audioBase64: base64, mimeType: blob.type || "audio/webm" },
        headers: { Authorization: `Bearer ${token}` },
      } as any);

      toast.success(
        `✅ R$ ${Number(result.expense.amount).toFixed(2)} · ${result.expense.category}`,
        { description: result.transcript }
      );
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar áudio");
    } finally {
      setProcessing(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10_000_000) {
      toast.error("Arquivo muito grande (máx 10 MB)");
      return;
    }
    await processBlob(file);
    e.target.value = "";
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="rounded-3xl bg-gradient-hero p-8 text-primary-foreground shadow-elevated">
      <div className="flex flex-col items-center text-center">
        <p className="text-sm opacity-80 mb-1">Registre um gasto</p>
        <h2 className="text-2xl font-display font-semibold mb-6">Fale o que gastou</h2>

        <div className="relative mb-6">
          {recording && (
            <div className="absolute inset-0 rounded-full bg-accent/40 animate-ping" />
          )}
          <button
            onClick={recording ? stop : start}
            disabled={processing}
            className="relative size-24 rounded-full bg-card text-primary flex items-center justify-center shadow-elevated hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={recording ? "Parar gravação" : "Iniciar gravação"}
          >
            {processing ? (
              <Loader2 className="size-9 animate-spin" />
            ) : recording ? (
              <Square className="size-9 fill-current" />
            ) : (
              <Mic className="size-9" />
            )}
          </button>
        </div>

        <p className="text-sm opacity-90 min-h-5">
          {processing
            ? "Transcrevendo e analisando..."
            : recording
              ? `Gravando ${fmt(elapsed)} — toque para parar`
              : 'Ex: "Gastei 90 reais com internet ontem"'}
        </p>

        <label className="mt-6 inline-flex items-center gap-2 text-xs opacity-80 hover:opacity-100 cursor-pointer">
          <Upload className="size-3.5" />
          ou enviar arquivo de áudio
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleUpload}
            disabled={processing || recording}
          />
        </label>
      </div>
    </div>
  );
}
