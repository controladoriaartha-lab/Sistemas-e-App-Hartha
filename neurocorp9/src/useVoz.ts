import { useCallback, useEffect, useRef, useState } from "react";

// Tipos minimos da Web Speech API (nao vem no lib.dom do TS).
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type Estado = "idle" | "ouvindo" | "erro";

export function useVoz(aoFinalizar: (texto: string) => void) {
  const [estado, setEstado] = useState<Estado>("idle");
  const [parcial, setParcial] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const ultimo = useRef("");
  const cb = useRef(aoFinalizar);
  cb.current = aoFinalizar;

  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  const suportado = Boolean(Ctor);

  const iniciar = useCallback(() => {
    if (!Ctor) {
      setErro("Reconhecimento de voz indisponível neste navegador. Use o Chrome ou digite.");
      setEstado("erro");
      return;
    }
    setErro(null);
    setParcial("");
    ultimo.current = "";
    const r = new Ctor();
    r.lang = "pt-BR";
    r.continuous = false;
    r.interimResults = true;
    r.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      ultimo.current = txt;
      setParcial(txt);
    };
    r.onerror = (e) => {
      const msg =
        e.error === "not-allowed"
          ? "Permissão do microfone negada."
          : e.error === "no-speech"
            ? "Não ouvi nada. Tente de novo."
            : `Erro de voz: ${e.error}`;
      setErro(msg);
      setEstado("erro");
    };
    r.onend = () => {
      setEstado((s) => (s === "erro" ? s : "idle"));
      const t = ultimo.current.trim();
      if (t) cb.current(t);
      setParcial("");
    };
    rec.current = r;
    setEstado("ouvindo");
    r.start();
  }, [Ctor]);

  const parar = useCallback(() => rec.current?.stop(), []);

  useEffect(() => () => rec.current?.stop(), []);

  return { estado, parcial, erro, suportado, iniciar, parar };
}
