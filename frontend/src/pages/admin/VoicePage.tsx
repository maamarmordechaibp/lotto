import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const SLOTS = [
  "welcome_greeting",
  "lottery_explanation",
  "payment_instructions",
  "confirmation_message",
  "winner_announcement",
  "goodbye_message",
  "error_message",
  "support_message",
];

interface VoicePrompt {
  id: string;
  lottery_id: string | null;
  slot: string;
  language: string;
  text_content: string | null;
  audio_url: string | null;
}

function usePrompts() {
  return useQuery({
    queryKey: ["voice-prompts"],
    queryFn: async (): Promise<VoicePrompt[]> => {
      const { data, error } = await supabase.from("voice_prompts").select("*");
      if (error) throw error;
      return (data as VoicePrompt[]) ?? [];
    },
  });
}

export function VoicePage() {
  const { data: prompts, isLoading } = usePrompts();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Voice Prompts</h2>
      <p className="text-sm text-muted-foreground">
        Edit TTS text or upload audio per prompt slot. Tag each with a language code for
        multi-language support.
      </p>
      {isLoading ? (
        <div className="space-y-3">
          {SLOTS.map((s) => <Skeleton key={s} className="h-24" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {SLOTS.map((slot) => {
            const items = prompts?.filter((p) => p.slot === slot) ?? [];
            return (
              <Card key={slot}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm">{slot}</CardTitle>
                  <Badge variant="outline">{items.length} lang</Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.length ? (
                    items.map((p) => (
                      <div key={p.id} className="rounded-md border p-2 text-sm">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="secondary">{p.language}</Badge>
                          {p.audio_url && <Badge variant="success">audio</Badge>}
                        </div>
                        <textarea
                          defaultValue={p.text_content ?? ""}
                          rows={2}
                          className="w-full rounded-md border border-input bg-background p-2 text-xs"
                        />
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No prompt configured.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
