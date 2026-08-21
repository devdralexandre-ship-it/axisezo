import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { HelpCircle, Send, RotateCcw, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Como cadastro um paciente?',
  'O que é a tolerância de uma ação?',
  'Quem enxerga quais pacientes?',
  'Como anexo um orçamento?',
];

const FUNCTION_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/axis-help`;

export function HelpAgent() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    setInput('');
    const history = [...messages, { role: 'user' as const, content: question }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setBusy(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Sessão expirada. Entre novamente.');

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        let msg = 'Falha ao consultar o assistente.';
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch { /* keep default */ }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...history, { role: 'assistant', content: acc }]);
      }
      if (!acc.trim()) {
        setMessages([...history, { role: 'assistant', content: 'Não consegui responder agora. Tente reformular a pergunta.' }]);
      }
    } catch (e) {
      setMessages(history);
      setError(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        aria-label="Ajuda do Axis"
        className="fixed bottom-4 right-4 z-40 h-11 w-11 rounded-full p-0 shadow-lg print:hidden"
      >
        <HelpCircle className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b px-4 py-3">
            <div className="flex items-center justify-between gap-2 pr-8">
              <SheetTitle className="text-base">Ajuda do Axis</SheetTitle>
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setMessages([]); setError(null); inputRef.current?.focus(); }}
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Nova conversa
                </Button>
              )}
            </div>
            <p className="text-left text-xs text-muted-foreground">
              Dúvidas de uso do sistema. Não consulta dados de pacientes.
            </p>
          </SheetHeader>

          <ScrollArea className="flex-1 px-4 py-3">
            {messages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Perguntas frequentes:</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full rounded-md border border-border/60 p-2 text-left text-sm hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm',
                      m.role === 'user'
                        ? 'ml-6 bg-primary text-primary-foreground'
                        : 'mr-2 bg-muted text-foreground',
                    )}
                  >
                    {m.role === 'assistant' ? (
                      m.content ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:text-sm">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )
                    ) : (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    )}
                  </div>
                ))}
                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
                )}
                <div ref={bottomRef} />
              </div>
            )}
            {messages.length === 0 && error && (
              <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}
          </ScrollArea>

          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Pergunte como usar o Axis..."
                rows={2}
                className="min-h-[44px] resize-none text-sm"
              />
              <Button
                size="icon"
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                aria-label="Enviar pergunta"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
