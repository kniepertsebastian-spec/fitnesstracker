import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { activityLevelSchema, genderSchema, nutritionGoalSchema } from "@fitnesstracker/shared";
import {
  ACTIVITY_LEVEL_LABELS,
  GENDER_LABELS,
  NUTRITION_GOAL_LABELS,
  useProfile,
  useUpsertProfile,
} from "../../hooks/useProfile";
import { Button, Card, Field, Input, Select, Skeleton, StatTile } from "../ui";

const formSchema = z.object({
  weightKg: z.coerce.number().positive(),
  heightCm: z.coerce.number().int().positive(),
  age: z.coerce.number().int().positive(),
  gender: genderSchema,
  activityLevel: activityLevelSchema,
  goal: nutritionGoalSchema,
});
type FormValues = z.infer<typeof formSchema>;

export function ProfileForm() {
  const { data: profile, isLoading } = useProfile();
  const upsertProfile = useUpsertProfile();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { gender: "MALE", activityLevel: "MODERATE", goal: "MAINTAIN" },
  });

  useEffect(() => {
    if (profile) {
      reset({
        weightKg: profile.weightKg,
        heightCm: profile.heightCm,
        age: profile.age,
        gender: profile.gender,
        activityLevel: profile.activityLevel,
        goal: profile.goal,
      });
    }
  }, [profile, reset]);

  const onSubmit = (data: FormValues) => {
    upsertProfile.mutate(data);
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
      <Card title="Profil">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gewicht (kg)">
              {(p) => <Input {...p} type="number" step="0.1" inputMode="decimal" {...register("weightKg")} />}
            </Field>
            <Field label="Größe (cm)">
              {(p) => <Input {...p} type="number" inputMode="numeric" {...register("heightCm")} />}
            </Field>
            <Field label="Alter">{(p) => <Input {...p} type="number" inputMode="numeric" {...register("age")} />}</Field>
            <Field label="Geschlecht">
              {(p) => (
                <Select {...p} {...register("gender")}>
                  {genderSchema.options.map((value) => (
                    <option key={value} value={value}>
                      {GENDER_LABELS[value]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <Field label="Aktivitätslevel">
            {(p) => (
              <Select {...p} {...register("activityLevel")}>
                {activityLevelSchema.options.map((value) => (
                  <option key={value} value={value}>
                    {ACTIVITY_LEVEL_LABELS[value]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Ziel">
            {(p) => (
              <Select {...p} {...register("goal")}>
                {nutritionGoalSchema.options.map((value) => (
                  <option key={value} value={value}>
                    {NUTRITION_GOAL_LABELS[value]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Button type="submit" variant="primary" size="lg" disabled={isSubmitting}>
            Speichern
          </Button>
        </form>
      </Card>

      {profile && (
        <Card title="Tagesbedarf">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Grundumsatz (BMR)" value={profile.bmr} unit="kcal" className="p-3" />
            <StatTile label="Gesamtumsatz (TDEE)" value={profile.tdee} unit="kcal" className="p-3" />
            <StatTile label="Ziel-Kalorien" value={profile.targetCalories} unit="kcal" className="p-3" />
            <StatTile label="Ziel-Protein" value={profile.targetProteinG} unit="g" className="p-3" />
          </div>
        </Card>
      )}
    </div>
  );
}
