import { z } from "zod";
export const VerdictSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("oracle"), verdict: z.string().max(700) }),
  z.object({ kind: z.literal("absurd"), verdict: z.string().max(700) }),
  z.object({
    kind: z.literal("idea"),
    score: z.number().min(0).max(10),
    advantage: z.string().max(700),
    flaw: z.string().max(700),
    verdict: z.string().max(700),
  }),
]);
export type Verdict = z.infer<typeof VerdictSchema>;
export const RequestSchema = z.object({
  question: z.string().trim().min(1).max(1500),
  attachment: z
    .object({
      format: z.enum(["png", "jpg"]),
      data: z
        .string()
        .max(1_400_000)
        .regex(/^[A-Za-z0-9+/]+={0,2}$/),
    })
    .optional(),
});
export const HistorySchema = z
  .array(
    z.object({
      id: z.string(),
      question: z.string().max(1500),
      verdict: VerdictSchema,
    }),
  )
  .max(30);
export type HistoryEntry = z.infer<typeof HistorySchema>[number];
export const lines = {
  verdict: {
    yes: "Tak. Daję okejkę. Tylko potem nie mów, że to był mój pomysł.",
    no: "Nie. Nawet moja Grażyna mówi, że nie. A ona kupiła air fryer na raty.",
    wait: "Prześpij się z tym. Najlepiej do następnej wypłaty.",
    risky: "Da się. Ale tak samo da się zjeść kebaba w białej koszuli.",
    test: "Najpierw mały test. Jak się wysypie, to przynajmniej nie na weselu.",
    unclear:
      "Nawet ja nie wiem. Dopisz konkrety, bo z fusów po energetyku nie wywróżę.",
    cosmic: "Kosmos zatwierdził. Ziemia wstrzymała się od głosu.",
    surreal:
      "To jest ten moment, w którym kebab zaczyna jeść ciebie. Miłego wtorku.",
    chaos:
      "Tak, ale tylko w alternatywnym wszechświecie, gdzie paczkomat odbiera ludzi.",
  },
  advantage: {
    demand:
      "Ktoś może za to zapłacić. W tym kraju to już przewaga konkurencyjna.",
    simple: "Da się sprawdzić bez kredytu i prezentacji na 80 slajdów.",
    novel:
      "Przynajmniej nie jest to kolejna apka do picia wody. Szanuję odklejkę.",
    useful: "Rozwiązuje prawdziwy problem. Aż zdjąłem okulary.",
    passion: "Jest w tym zajawka. Tego nie kupisz nawet w promce.",
  },
  flaw: {
    money:
      "Excel płacze. Ktoś musi za to zapłacić i oby to nie była twoja mama.",
    crowded:
      "Ktoś już to pewnie robi. I ma budżet większy niż twój paragon z Żabki.",
    execution:
      "Pomysł jest. Teraz tylko ta drobnostka: zrobić, dowieźć i nie spierdolić w środę.",
    demand: "Ty tego chcesz. Pytanie, czy chce tego ktokolwiek poza tobą.",
    risk: "Ryzyko wystaje bardziej niż mój nos. Sprawdź założenia, zanim odpalisz oszczędności.",
  },
};
