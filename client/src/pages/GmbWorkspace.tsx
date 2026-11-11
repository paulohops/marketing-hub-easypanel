import { useState } from "react";
import { toast } from "sonner";
import {
  Store,
  MapPin,
  Phone,
  Globe,
  Clock,
  Star,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { WorkspaceHeader, WorkspaceShell, WorkspaceSection } from "@/components/WorkspaceChrome";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

export default function GmbWorkspace() {
  const utils = trpc.useUtils();
  const accountsQuery = trpc.social.listAccounts.useQuery();
  const locationsQuery = trpc.social.listGmbLocations.useQuery();

  const [searchTerm, setSearchTerm] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any | null>(null);

  const [form, setForm] = useState({
    accountId: 0,
    locationName: "",
    googleLocationId: "",
    address: "",
    phone: "",
    websiteUri: "",
    regularHours: "Seg-Sex: 08:00 - 18:00 | Sáb: 08:00 - 12:00",
    status: "OPEN" as "OPEN" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY",
    rating: 5,
  });

  const createLocationMutation = trpc.social.createGmbLocation.useMutation({
    onSuccess: () => {
      utils.social.listGmbLocations.invalidate();
      setCreateModalOpen(false);
      resetForm();
      toast.success("Unidade do Google Meu Negócio vinculada!");
    },
    onError: err => toast.error(err.message),
  });

  const updateLocationMutation = trpc.social.updateGmbLocation.useMutation({
    onSuccess: () => {
      utils.social.listGmbLocations.invalidate();
      setEditingLocation(null);
      resetForm();
      toast.success("Dados da ficha atualizados no Google Meu Negócio!");
    },
    onError: err => toast.error(err.message),
  });

  const deleteLocationMutation = trpc.social.deleteGmbLocation.useMutation({
    onSuccess: () => {
      utils.social.listGmbLocations.invalidate();
      toast.success("Ficha removida.");
    },
    onError: err => toast.error(err.message),
  });

  const resetForm = () => {
    setForm({
      accountId: 0,
      locationName: "",
      googleLocationId: "",
      address: "",
      phone: "",
      websiteUri: "",
      regularHours: "Seg-Sex: 08:00 - 18:00 | Sáb: 08:00 - 12:00",
      status: "OPEN",
      rating: 5,
    });
  };

  const handleOpenEdit = (loc: any) => {
    setEditingLocation(loc);
    setForm({
      accountId: loc.accountId,
      locationName: loc.locationName,
      googleLocationId: loc.googleLocationId,
      address: loc.address || "",
      phone: loc.phone || "",
      websiteUri: loc.websiteUri || "",
      regularHours: loc.regularHours || "Seg-Sex: 08:00 - 18:00 | Sáb: 08:00 - 12:00",
      status: loc.status || "OPEN",
      rating: Number(loc.rating) || 5,
    });
  };

  const locations = locationsQuery.data || [];
  const gmbAccounts = (accountsQuery.data || []).filter(a => a.platform === "google_business");

  const filteredLocations = locations.filter(l => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      l.locationName.toLowerCase().includes(term) ||
      (l.address && l.address.toLowerCase().includes(term))
    );
  });

  return (
    <WorkspaceShell>
      <WorkspaceHeader
        eyebrow="Social Media Hub"
        title="Google Meu Negócio"
        description="Gerencie e edite centralizadamente as fichas de múltiplas unidades físicas: atualize horários de atendimento, telefones, links e acompanhe avaliações no Google Maps."
        icon={Store}
        actions={
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              if (gmbAccounts.length > 0) {
                setForm(f => ({ ...f, accountId: gmbAccounts[0].id }));
              }
              setCreateModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Ficha / Unidade
          </Button>
        }
      />

      {/* Top Search & Stats */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-card">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome da filial ou cidade..."
            className="pl-8 h-9 text-xs"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{locations.length} unidades gerenciadas</span>
          <span className="flex items-center gap-1 text-amber-500 font-semibold">
            <Star className="h-3.5 w-3.5 fill-amber-500" /> 4.9 estrelas média
          </span>
        </div>
      </div>

      {/* Locations Grid */}
      <div className="mt-5">
        {filteredLocations.length === 0 && !locationsQuery.isLoading ? (
          <Card className="p-8 text-center border-dashed border-2 border-border bg-card/40">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 mb-4">
              <Store className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Nenhuma unidade cadastrada</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
              Cadastre suas lojas físicas e filiais vinculadas à conta do Google Meu Negócio para editar horários e detalhes diretamente por aqui.
            </p>
            <Button
              className="mt-5"
              onClick={() => {
                resetForm();
                if (gmbAccounts.length > 0) {
                  setForm(f => ({ ...f, accountId: gmbAccounts[0].id }));
                }
                setCreateModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Primeira Loja
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredLocations.map(loc => (
              <Card key={loc.id} className="border-border bg-card shadow-sm hover:shadow-md transition flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-semibold leading-tight line-clamp-1">
                        {loc.locationName}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1 flex items-center gap-1 line-clamp-1">
                        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                        {loc.address || "Endereço não cadastrado"}
                      </CardDescription>
                    </div>

                    <Badge
                      className={
                        loc.status === "OPEN"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-300 dark:border-emerald-800"
                          : "bg-rose-500/10 text-rose-600 border-rose-300 dark:border-rose-800"
                      }
                    >
                      {loc.status === "OPEN" ? "Aberta" : "Fechada"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2.5 text-xs pb-3">
                  {/* Hours */}
                  <div className="p-2 rounded-lg bg-muted/40 flex items-start gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold block text-foreground">Horário de Atendimento:</span>
                      <span className="text-muted-foreground">{loc.regularHours || "Consulte a loja"}</span>
                    </div>
                  </div>

                  {/* Phone & Website */}
                  <div className="space-y-1 text-muted-foreground">
                    {loc.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-primary shrink-0" />
                        <span>{loc.phone}</span>
                      </p>
                    )}
                    {loc.websiteUri && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Globe className="h-3 w-3 text-primary shrink-0" />
                        <a href={loc.websiteUri} target="_blank" rel="noreferrer" className="hover:underline text-primary truncate">
                          {loc.websiteUri}
                        </a>
                      </p>
                    )}
                  </div>

                  {/* Rating */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                    <span className="flex items-center gap-1 font-semibold text-amber-600">
                      <Star className="h-3.5 w-3.5 fill-amber-500" />
                      {loc.rating || "5.0"}
                      <span className="text-muted-foreground font-normal">
                        ({loc.reviewCount || 0} avaliações)
                      </span>
                    </span>
                    <span className="text-muted-foreground">ID: {loc.googleLocationId}</span>
                  </div>
                </CardContent>

                {/* Footer Actions */}
                <div className="p-3 border-t border-border flex items-center justify-between bg-muted/20">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => handleOpenEdit(loc)}
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                    Editar Ficha
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    onClick={() => deleteLocationMutation.mutate({ id: loc.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog: Create or Edit Location */}
      <Dialog
        open={createModalOpen || Boolean(editingLocation)}
        onOpenChange={open => {
          if (!open) {
            setCreateModalOpen(false);
            setEditingLocation(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? "Editar Ficha Google Meu Negócio" : "Cadastrar Nova Unidade Local"}
            </DialogTitle>
            <DialogDescription>
              As alterações feitas aqui atualizam o perfil da loja nos resultados de busca do Google e Google Maps.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={e => {
              e.preventDefault();
              if (editingLocation) {
                updateLocationMutation.mutate({
                  id: editingLocation.id,
                  locationName: form.locationName,
                  phone: form.phone,
                  websiteUri: form.websiteUri,
                  regularHours: form.regularHours,
                  status: form.status,
                });
              } else {
                createLocationMutation.mutate({
                  accountId: form.accountId || (gmbAccounts[0]?.id || 1),
                  locationName: form.locationName,
                  googleLocationId: form.googleLocationId,
                  address: form.address,
                  phone: form.phone,
                  websiteUri: form.websiteUri,
                  regularHours: form.regularHours,
                  status: form.status,
                  rating: form.rating,
                });
              }
            }}
            className="space-y-3.5 pt-2"
          >
            {!editingLocation && (
              <div>
                <Label>Conta Google Vinculada</Label>
                <Select
                  value={String(form.accountId || gmbAccounts[0]?.id || "")}
                  onValueChange={v => setForm(f => ({ ...f, accountId: Number(v) }))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione a conta Google" />
                  </SelectTrigger>
                  <SelectContent>
                    {gmbAccounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.accountName} ({a.accountIdentifier})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="loc-name">Nome da Filial / Loja</Label>
              <Input
                id="loc-name"
                required
                placeholder="Ex: OnNet Telecom - Patrocínio Centro"
                value={form.locationName}
                onChange={e => setForm(f => ({ ...f, locationName: e.target.value }))}
                className="h-9 text-xs"
              />
            </div>

            {!editingLocation && (
              <div>
                <Label htmlFor="loc-id">Google Location ID</Label>
                <Input
                  id="loc-id"
                  required
                  placeholder="Ex: locations/1049281928"
                  value={form.googleLocationId}
                  onChange={e => setForm(f => ({ ...f, googleLocationId: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
            )}

            <div>
              <Label htmlFor="loc-address">Endereço Completo</Label>
              <Input
                id="loc-address"
                placeholder="Ex: Av. Rui Barbosa, 120 - Centro, Patrocínio - MG"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="loc-phone">Telefone / WhatsApp</Label>
                <Input
                  id="loc-phone"
                  placeholder="(34) 3831-0000"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="loc-status">Status de Funcionamento</Label>
                <Select
                  value={form.status}
                  onValueChange={(val: any) => setForm(f => ({ ...f, status: val }))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Aberta Normal</SelectItem>
                    <SelectItem value="CLOSED_TEMPORARILY">Fechada Temporariamente</SelectItem>
                    <SelectItem value="CLOSED_PERMANENTLY">Fechada Definitivamente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="loc-web">Link do Site / Página da Loja</Label>
              <Input
                id="loc-web"
                placeholder="https://onnetmais.com.br/loja-patrocinio"
                value={form.websiteUri}
                onChange={e => setForm(f => ({ ...f, websiteUri: e.target.value }))}
                className="h-9 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="loc-hours">Horário de Funcionamento</Label>
              <Textarea
                id="loc-hours"
                rows={2}
                placeholder="Seg-Sex: 08:00 - 18:00 | Sáb: 08:00 - 12:00"
                value={form.regularHours}
                onChange={e => setForm(f => ({ ...f, regularHours: e.target.value }))}
                className="text-xs resize-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateModalOpen(false);
                  setEditingLocation(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createLocationMutation.isPending || updateLocationMutation.isPending}
              >
                {editingLocation ? "Salvar Ficha" : "Cadastrar Loja"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </WorkspaceShell>
  );
}
