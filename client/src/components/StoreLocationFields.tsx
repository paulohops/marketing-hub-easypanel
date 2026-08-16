import { ClipboardPaste, Clock3, MapPinned } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseCoordinates } from "@shared/location";
import { STORE_WEEKDAYS, parseStoreHours, serializeStoreHours, type StoreDayHours, type StoreHours, type StoreWeekday } from "@shared/storeHours";

type CoordinatesFieldProps = {
  latitude: string;
  longitude: string;
  setLatitude: (value: string) => void;
  setLongitude: (value: string) => void;
};

export function CoordinatesField({ latitude, longitude, setLatitude, setLongitude }: CoordinatesFieldProps) {
  const [coordinatesText, setCoordinatesText] = useState("");
  const [message, setMessage] = useState("");

  const fillCoordinates = () => {
    const parsed = parseCoordinates(coordinatesText);
    if (!parsed) {
      setMessage("Cole duas coordenadas válidas, por exemplo: -18.5921, -46.5142.");
      return;
    }
    setLatitude(parsed.latitude);
    setLongitude(parsed.longitude);
    setMessage("Latitude e longitude preenchidas.");
  };

  return (
    <div className="sm:col-span-2 rounded-xl border border-border bg-secondary/20 p-3">
      <div className="flex items-center gap-2">
        <MapPinned className="h-4 w-4 text-primary" />
        <div>
          <p className="text-sm font-semibold text-foreground">Localização</p>
          <p className="text-xs text-muted-foreground">Cole as coordenadas copiadas do Google Maps para preencher os dois campos.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input aria-label="Colar coordenadas do Google Maps" value={coordinatesText} onChange={event => { setCoordinatesText(event.target.value); setMessage(""); }} placeholder="Ex.: -18.5921, -46.5142" />
        <Button type="button" variant="outline" onClick={fillCoordinates} className="shrink-0"><ClipboardPaste className="mr-2 h-4 w-4" />Preencher</Button>
      </div>
      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="store-latitude">Latitude</Label><Input id="store-latitude" value={latitude} onChange={event => setLatitude(event.target.value)} inputMode="decimal" placeholder="-18.5921000" /></div>
        <div className="space-y-2"><Label htmlFor="store-longitude">Longitude</Label><Input id="store-longitude" value={longitude} onChange={event => setLongitude(event.target.value)} inputMode="decimal" placeholder="-46.5142000" /></div>
      </div>
    </div>
  );
}

type StoreHoursFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function StoreHoursField({ value, onChange }: StoreHoursFieldProps) {
  const hours = parseStoreHours(value);
  const updateDay = (key: StoreWeekday, next: Partial<StoreDayHours>) => {
    const updated: StoreHours = { ...hours, [key]: { ...hours[key], ...next } };
    onChange(serializeStoreHours(updated));
  };

  return (
    <section className="sm:col-span-2 rounded-xl border border-border bg-secondary/20 p-3">
      <div className="flex items-center gap-2">
        <Clock3 className="h-4 w-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Horário de funcionamento</h3>
          <p className="text-xs text-muted-foreground">Selecione os dias abertos e informe os horários de abertura e fechamento.</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {STORE_WEEKDAYS.map(({ key, label }) => {
          const day = hours[key];
          return <div key={key} className={`grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_130px_130px] sm:items-center ${day.enabled ? "border-primary/30 bg-background" : "border-border bg-muted/20"}`}>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground"><input type="checkbox" checked={day.enabled} onChange={event => updateDay(key, { enabled: event.target.checked })} className="h-4 w-4 accent-primary" />{label}</label>
            <label className="space-y-1 text-xs text-muted-foreground"><span>Abertura</span><Input type="time" aria-label={`${label} - abertura`} value={day.open} disabled={!day.enabled} onChange={event => updateDay(key, { open: event.target.value })} /></label>
            <label className="space-y-1 text-xs text-muted-foreground"><span>Fechamento</span><Input type="time" aria-label={`${label} - fechamento`} value={day.close} disabled={!day.enabled} onChange={event => updateDay(key, { close: event.target.value })} /></label>
          </div>;
        })}
      </div>
    </section>
  );
}
