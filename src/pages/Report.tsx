import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useIncidents } from "@/store/incidents";
import { animalTypes, Severity } from "@/data/incidents";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  MapPin,
  User,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Crosshair,
  Sparkles,
  X,
} from "lucide-react";
import { z } from "zod";

const severities: { value: Severity; label: string; desc: string; ring: string; text: string }[] = [
  { value: "critical", label: "Critical", desc: "Immediate danger", ring: "border-severity-critical bg-severity-critical/5", text: "text-severity-critical" },
  { value: "high", label: "High", desc: "Aggressive behavior", ring: "border-severity-high bg-severity-high/5", text: "text-severity-high" },
  { value: "medium", label: "Medium", desc: "Caution needed", ring: "border-severity-medium bg-severity-medium/5", text: "text-severity-medium" },
  { value: "low", label: "Low", desc: "Sighting only", ring: "border-severity-low bg-severity-low/5", text: "text-severity-low" },
];

const reportSchema = z.object({
  location: z.string().trim().min(2, "Location must be at least 2 characters").max(200),
  reporter: z.string().trim().min(1, "Your name is required").max(80),
  description: z.string().trim().min(5, "Add a few words about what you saw").max(2000),
});

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

export default function Report() {
  const { addIncident } = useIncidents();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [animal, setAnimal] = useState(animalTypes[0]);
  const [severity, setSeverity] = useState<Severity>("medium");
  const [location, setLocation] = useState(() => searchParams.get("location") ?? "");
  const [reporter, setReporter] = useState("");
  const [description, setDescription] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(() => {
    const lat = parseFloat(searchParams.get("lat") ?? "");
    const lng = parseFloat(searchParams.get("lng") ?? "");
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  });
  const [geoBusy, setGeoBusy] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Toast once on mount when prefilled from chat / map.
  useEffect(() => {
    if (searchParams.get("location") || searchParams.get("lat")) {
      toast.success("Location prefilled from your map view");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation isn't supported in this browser");
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoBusy(false);
        toast.success("Location captured");
      },
      (err) => {
        setGeoBusy(false);
        toast.error(err.message || "Couldn't get your location");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Photos only (jpg/png/webp/heic).");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Image is too large (max 5 MB).");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
  };

  const askAI = async () => {
    if (description.trim().length < 5) {
      toast.error("Add a longer description first.");
      return;
    }
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-severity", {
        body: { description, animal: animal.label },
      });
      if (error) throw error;
      const sev = (data as { severity?: Severity; summary?: string })?.severity;
      const summary = (data as { summary?: string })?.summary;
      if (sev && ["critical", "high", "medium", "low"].includes(sev)) {
        setSeverity(sev);
        setAiSummary(summary ?? null);
        toast.success(`AI suggested: ${sev}`);
      } else {
        toast.error("AI didn't return a usable suggestion.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI request failed";
      toast.error(msg);
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = reportSchema.safeParse({ location, reporter, description });
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      toast.error(first ?? "Please complete all fields");
      return;
    }
    setSubmitting(true);
    try {
      let photoPath: string | null = null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `incidents/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("incident-photos")
          .upload(path, photoFile, { contentType: photoFile.type, upsert: false });
        if (upErr) {
          console.error(upErr);
          toast.error("Photo upload failed — submitting report without it.");
        } else {
          photoPath = path;
        }
      }

      const id = await addIncident({
        animal: animal.label,
        emoji: animal.emoji,
        severity,
        location: parsed.data.location,
        reporter: parsed.data.reporter,
        description: parsed.data.description,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        photoPath,
      });
      if (!id) {
        toast.error("Couldn't submit report. Try again.");
        setSubmitting(false);
        return;
      }
      toast.success("Report submitted — responders notified", {
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      setTimeout(() => navigate("/"), 700);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-8 md:py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Sighting Report Form
          </div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Report Incident
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Help keep BC campus safe. Submitted reports are sent immediately to security and conservation responders.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-6">
            {/* Animal type */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Animal Type
              </Label>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {animalTypes.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => setAnimal(a)}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-semibold transition-smooth ${
                      animal.label === a.label
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/20"
                    }`}
                  >
                    <span className="text-2xl">{a.emoji}</span>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity */}
            <div>
              <div className="flex items-end justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Severity Level
                </Label>
                <button
                  type="button"
                  onClick={askAI}
                  disabled={aiBusy}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground transition-smooth hover:bg-secondary disabled:opacity-60"
                >
                  {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Suggest with AI
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                {severities.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSeverity(s.value)}
                    className={`flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-smooth ${
                      severity === s.value
                        ? s.ring
                        : "border-border bg-card hover:border-foreground/20"
                    }`}
                  >
                    <span className={`text-sm font-bold ${s.text}`}>
                      {s.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{s.desc}</span>
                  </button>
                ))}
              </div>
              {aiSummary && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 px-3 py-2 text-xs text-foreground">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />
                  <span><strong>AI summary:</strong> {aiSummary}</span>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="location" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Location
                </Label>
                <div className="relative mt-2">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="location"
                    placeholder="e.g. Library East entrance"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    maxLength={200}
                    className="pl-9"
                  />
                </div>
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={geoBusy}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-smooth hover:underline disabled:opacity-60"
                >
                  {geoBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3" />}
                  {coords ? `GPS: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "Use my current location"}
                </button>
              </div>
              <div>
                <Label htmlFor="reporter" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Your Name
                </Label>
                <div className="relative mt-2">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reporter"
                    placeholder="First L."
                    value={reporter}
                    onChange={(e) => setReporter(e.target.value)}
                    maxLength={80}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="desc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Description
              </Label>
              <Textarea
                id="desc"
                placeholder="What did you see? Behavior, direction of travel, number of animals..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={2000}
                className="mt-2 resize-none"
              />
              <div className="mt-1 text-right text-[10px] text-muted-foreground">
                {description.length}/2000
              </div>
            </div>

            {/* Photo upload */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Photo evidence (optional)
              </Label>
              {photoPreview ? (
                <div className="relative mt-2 overflow-hidden rounded-xl border border-border bg-card">
                  <img
                    src={photoPreview}
                    alt="Selected preview"
                    className="max-h-64 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-foreground shadow-card transition-smooth hover:bg-background"
                    aria-label="Remove photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/40 px-4 py-6 text-sm font-medium text-muted-foreground transition-smooth hover:border-foreground/30 hover:text-foreground">
                  <Camera className="h-4 w-4" />
                  Add a photo (max 5 MB)
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={onPhoto}
                  />
                </label>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="flex-1 rounded-full shadow-emergency"
              >
                {submitting ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="mr-1 h-4 w-4" />
                )}
                Submit Report
              </Button>
              <Button type="button" variant="outline" size="lg" className="rounded-full" onClick={() => navigate("/")}>
                Cancel
              </Button>
            </div>
          </form>
        </div>

        {/* Side panel */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-2xl bg-foreground p-5 text-background shadow-elevated">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Live Preview</h3>
            <div className="mt-4 flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background/10 text-2xl">
                {animal.emoji}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                  {severity}
                </div>
                <div className="font-display text-lg font-bold leading-tight">
                  {animal.label}
                </div>
                <div className="mt-1 text-xs opacity-70">
                  {location || "Location pending..."}
                </div>
                {coords && (
                  <div className="mt-0.5 font-mono text-[10px] opacity-60">
                    {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </div>
                )}
              </div>
            </div>
            <p className="mt-3 line-clamp-3 text-xs opacity-80">
              {description || "Description will appear here once added."}
            </p>
            {photoPreview && (
              <img
                src={photoPreview}
                alt=""
                className="mt-3 h-24 w-full rounded-lg object-cover opacity-90"
              />
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              In Emergency
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              If a person is in immediate danger, call <strong className="text-foreground">911</strong> first, then file this report.
            </p>
            <a
              href="tel:1-800-555-0199"
              className="mt-3 flex items-center justify-between rounded-xl bg-gradient-emergency px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-emergency"
            >
              Campus Security
              <span className="font-mono">1-800-555-0199</span>
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
