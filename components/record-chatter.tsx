"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { getRecordChatter, postRecordChatter } from "@/lib/api";
import type { ChatterMessage } from "@/lib/types";

interface RecordChatterProps {
  recordType: "trip" | "access";
  recordId?: number | string;
  context?: any;
  title?: string;
  compact?: boolean;
}

export function RecordChatter({ recordType, recordId, context, title = "Conversación", compact = false }: RecordChatterProps) {
  const numericId = Number(recordId);
  const enabled = Number.isFinite(numericId) && numericId > 0;
  const [messages, setMessages] = useState<ChatterMessage[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const contextKey = useMemo(() => JSON.stringify(context || {}), [context]);

  const load = useCallback(async (silent = false) => {
    if (!enabled) return;
    if (!silent) setLoading(true);
    try {
      setMessages(await getRecordChatter(recordType, numericId, context));
    } catch (error) {
      if (!silent) {
        toast.error("No se pudo cargar el chatter", {
          description: error instanceof Error ? error.message : "Error desconocido",
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [context, enabled, numericId, recordType]);

  useEffect(() => {
    load();
    if (!enabled) return;
    const timer = window.setInterval(() => load(true), 5000);
    return () => window.clearInterval(timer);
  }, [enabled, load, contextKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const handleSend = async () => {
    const clean = message.trim();
    if (!enabled || !clean || sending) return;
    setSending(true);
    try {
      const updated = await postRecordChatter(recordType, numericId, clean, context);
      setMessages(updated);
      setMessage("");
      toast.success("Mensaje enviado al chatter de Odoo");
    } catch (error) {
      toast.error("No se pudo enviar el mensaje", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setSending(false);
    }
  };

  if (!enabled) return null;

  return (
    <Card className="border-border bg-secondary/20 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span>{title}</span>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => load()} disabled={loading}>
          {loading ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className={`${compact ? "max-h-52" : "max-h-72"} space-y-2 overflow-y-auto rounded-md border border-border bg-background/60 p-2`}>
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Spinner className="h-4 w-4" /> Cargando conversación...
          </div>
        ) : messages.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No hay mensajes todavía. Escribe el primer comentario para Odoo.
          </div>
        ) : (
          messages.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-card p-3">
              <div className="mb-1 text-xs">
                <span className="font-semibold text-foreground">{item.author}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{item.body}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Escribe un mensaje para el chatter de Odoo..."
          className="min-h-20 flex-1 resize-none"
          maxLength={2000}
        />
        <Button type="button" className="sm:w-32" onClick={handleSend} disabled={sending || !message.trim()}>
          {sending ? <Spinner className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
          Enviar
        </Button>
      </div>
    </Card>
  );
}
