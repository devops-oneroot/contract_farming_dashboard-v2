"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Search, UsersRound, X } from "lucide-react";

import { api, type FarmerMeetup, type MeetupFarmer } from "../lib/api";
import { useAuth } from "../lib/auth";
import { canDo } from "../lib/rbac";
import { Loader, LoadingOverlay } from "../components/loading";
import { DateInput, Dropdown } from "../components/ui";
import { LocationField, PointsOrParagraph } from "./meetup-fields";
import { TouchPoints } from "../components/touch-points";

/** App roles as the organizer dropdown names them. */
const ROLE_NAME: Record<string, string> = {
  agronomist: "Agronomist",
  senior_agronomist: "Senior agronomist",
  attendance_staff: "Attendance staff",
};
import { Pagination, usePaged } from "../components/pagination";

const PAGE_SIZE = 20;
const NAME_MAX = 200;
const DESC_MAX = 2000;

const field =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700";

const fmtDate = (s: string) =>
  new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Today as 'YYYY-MM-DD' in this browser's zone (India for the team). */
const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** 'YYYY-MM-DD' as "28 Nov 2026", without a time zone shifting the day. */
const fmtDay = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

/** The farmers registered for one meetup from the app. */
function MeetupFarmersDialog({ meetup, onClose }: { meetup: FarmerMeetup; onClose: () => void }) {
  const [items, setItems] = useState<MeetupFarmer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listMeetupFarmers(meetup._id)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the farmers"));
  }, [meetup._id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="meetup-farmers-title"
        onClick={(e) => e.stopPropagation()}
        className="modal-panel flex flex-col sm:max-w-5xl"
      >
        <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-900">
          <div className="min-w-0 flex-1">
            <h2 id="meetup-farmers-title" className="text-lg font-semibold">
              {meetup.name}
            </h2>
            <p className="text-sm text-zinc-500">
              {meetup.meetupDate ? `${fmtDay(meetup.meetupDate)} · ` : ""}Farmers registered from the app
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <X size={18} />
          </button>
        </div>
        <div className="scroll-thin max-h-[70dvh] overflow-y-auto px-5 py-4">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : items === null ? (
            <Loader />
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No farmers registered yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Farmer</th>
                  <th className="py-2 pr-3 font-medium">Place</th>
                  <th className="py-2 pr-3 text-right font-medium">Acres</th>
                  <th className="py-2 pr-3 font-medium">Touch points</th>
                  <th className="py-2 pr-3 font-medium">Added by</th>
                  <th className="py-2 font-medium">Added on</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {items.map((f) => (
                  <tr key={f._id} className="align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{f.name}</div>
                      <div className="text-xs text-zinc-500">{f.mobile}</div>
                    </td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">
                      {[f.village, f.taluk, f.district].filter(Boolean).join(", ")}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{f.acres ?? "-"}</td>
                    <td className="py-2 pr-3">
                      <TouchPoints items={f.touchPoints ?? []} />
                    </td>
                    <td className="py-2 pr-3">{f.recordedBy?.name || "-"}</td>
                    <td className="whitespace-nowrap py-2 text-zinc-600 dark:text-zinc-400">{fmtDate(f.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/** Add a meetup: the name is required, the description optional. */
function MeetupDialog({
  meetup,
  onClose,
  onSaved,
}: {
  /** The meetup to edit; left out to add a new one. */
  meetup?: FarmerMeetup;
  onClose: () => void;
  onSaved: (m: FarmerMeetup) => void;
}) {
  const editing = !!meetup;
  const [name, setName] = useState(meetup?.name ?? "");
  const [description, setDescription] = useState(meetup?.description ?? "");
  const [meetupDate, setMeetupDate] = useState(meetup?.meetupDate ?? "");
  const [place, setPlace] = useState({
    village: meetup?.village ?? "",
    taluk: meetup?.taluk ?? "",
    district: meetup?.district ?? "",
  });
  const [expected, setExpected] = useState(meetup?.expectedFarmers != null ? String(meetup.expectedFarmers) : "");
  const [products, setProducts] = useState(meetup?.products ?? "");
  const [organizerId, setOrganizerId] = useState(meetup?.organizer?._id ?? "");
  const [visited, setVisited] = useState(meetup?.visitedFarmers != null ? String(meetup.visitedFarmers) : "");
  /** Every app user who can organise, for the dropdown. */
  const [organizers, setOrganizers] = useState<{ _id: string; name: string; mobile: string; role: string }[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listMeetupOrganizers()
      .then((r) => setOrganizers(r.items))
      .catch(() => setOrganizers([]));
  }, []);

  const productsGiven = products.replace(/•/g, "").trim().length > 0;
  const placeGiven = !!(place.village.trim() && place.taluk.trim() && place.district.trim());
  const expectedNum = Number(expected);
  const expectedOk = expected.trim() !== "" && Number.isInteger(expectedNum) && expectedNum >= 1;
  const visitedOk = visited.trim() === "" || (Number.isInteger(Number(visited)) && Number(visited) >= 0);
  const ready = !!name.trim() && !!meetupDate && placeGiven && expectedOk && productsGiven && !!organizerId && visitedOk;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Meetup name is required.");
    if (!meetupDate) return setError("Meetup date is required.");
    if (!placeGiven) return setError("Location is required: pick the village.");
    if (!expectedOk) return setError("Enter the number of expected farmers (1 or more).");
    if (!productsGiven) return setError("Add at least one product.");
    if (!organizerId) return setError("Choose the organizer.");
    if (!visitedOk) return setError("Farmers visited must be a whole number.");
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        meetupDate,
        village: place.village.trim(),
        taluk: place.taluk.trim(),
        district: place.district.trim(),
        expectedFarmers: expectedNum,
        products: products.trim(),
        organizerId,
        visitedFarmers: visited.trim() === "" ? null : Number(visited),
      };
      const res = meetup ? await api.updateFarmerMeetup(meetup._id, body) : await api.createFarmerMeetup(body);
      onSaved(res.meetup);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the meetup");
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !saving && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="meetup-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="modal-panel flex flex-col sm:max-w-2xl"
      >
        <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-900">
          <h2 id="meetup-title" className="min-w-0 flex-1 text-lg font-semibold">
            {editing ? "Edit meetup" : "Add meetup"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <X size={18} />
          </button>
        </div>

        <div className="scroll-thin max-h-[70dvh] space-y-4 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              Meetup name <span className="text-red-600">*</span>
            </span>
            <input
              autoFocus
              required
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Paddy growers meet, Mandya"
              className={field}
            />
          </label>
          {/* A div, not a label: the common calendar opens from its own button. */}
          <div>
            <span className="mb-1 block text-sm font-medium">
              Meetup date <span className="text-red-600">*</span>
            </span>
            {/* The dashboard's common calendar. A new meetup cannot be in the past; an
                existing one keeps whatever day it has. */}
            <DateInput
              aria-label="Meetup date"
              required
              value={meetupDate}
              min={editing ? undefined : todayYmd()}
              onChange={(e) => setMeetupDate(e.target.value)}
              className="w-full"
            />
            <span className="mt-1 block text-xs text-zinc-400">The app offers a meetup until this day is over.</span>
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium">
              Location <span className="text-red-600">*</span>
            </span>
            <LocationField value={place} onChange={setPlace} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                Expected farmers <span className="text-red-600">*</span>
              </span>
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={expected}
                onChange={(e) => setExpected(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 50"
                className={field}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                Total farmers visited <span className="text-xs font-normal text-zinc-400">(optional)</span>
              </span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={visited}
                onChange={(e) => setVisited(e.target.value.replace(/\D/g, ""))}
                placeholder="After the meetup"
                className={field}
              />
            </label>
          </div>

          {/* A div, not a label: the dropdown opens from its own button. */}
          <div>
            <span className="mb-1 block text-sm font-medium">
              Organizer <span className="text-red-600">*</span>
            </span>
            <Dropdown
              aria-label="Organizer"
              isSearch
              searchPlaceholder="Search name or mobile"
              placeholder={organizers === null ? "Loading app users…" : "Choose an app user"}
              emptyText="No app user matches"
              value={organizerId}
              onChange={setOrganizerId}
              options={(organizers ?? []).map((o) => ({
                value: o._id,
                label: o.name || o.mobile,
                hint: [o.mobile, ROLE_NAME[o.role] ?? o.role].filter(Boolean).join(" · "),
              }))}
              className="w-full"
            />
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium">
              Products <span className="text-red-600">*</span>
            </span>
            <PointsOrParagraph value={products} onChange={setProducts} placeholder="e.g. Bio fertiliser 5 kg" />
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Description</span>
            <textarea
              value={description}
              maxLength={DESC_MAX}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="What the meetup is about, where and when"
              className={`${field} resize-y`}
            />
            <span className="mt-1 block text-right text-xs text-zinc-400">
              {description.length} / {DESC_MAX}
            </span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3 dark:border-zinc-900">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !ready}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Save meetup"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Others → Farmer Meetup: every meetup, newest first, and a way to add one. */
export default function FarmerMeetupsPage() {
  const { admin } = useAuth();
  const canAdd = canDo(admin, "farmer_meetups", "add");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<FarmerMeetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const canEdit = canDo(admin, "farmer_meetups", "edit");
  /** The meetup being edited. */
  const [editingMeetup, setEditingMeetup] = useState<FarmerMeetup | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** The meetup whose registered farmers are open. */
  const [farmersOf, setFarmersOf] = useState<FarmerMeetup | null>(null);

  useEffect(() => {
    let live = true;
    // Wait for a pause only while typing; the first load is immediate.
    const t = setTimeout(
      () => {
        setLoading(true);
        api
          .listFarmerMeetups(search.trim() || undefined)
          .then((r) => {
            if (!live) return;
            setRows(r.items);
            setError(null);
          })
          .catch((e) => live && setError(e instanceof Error ? e.message : "Could not load meetups"))
          .finally(() => live && setLoading(false));
      },
      search.trim() ? 300 : 0
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [search]);

  const { pageItems, pager } = usePaged(rows, PAGE_SIZE, search);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <UsersRound size={20} className="text-brand-600" /> Farmer Meetup
          </h1>
          <p className="text-sm text-zinc-500">Meetups planned with farmers, newest first.</p>
        </div>
        {canAdd && (
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setAdding(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            <Plus size={15} /> Add meetup
          </button>
        )}
      </div>

      {adding && (
        <MeetupDialog
          onClose={() => setAdding(false)}
          onSaved={(m) => {
            setAdding(false);
            setNotice(`"${m.name}" added.`);
            // Shown at the top straight away; a search that hides it clears.
            if (search.trim()) setSearch("");
            else setRows((list) => [m, ...list]);
          }}
        />
      )}

      {editingMeetup && (
        <MeetupDialog
          meetup={editingMeetup}
          onClose={() => setEditingMeetup(null)}
          onSaved={(m) => {
            setEditingMeetup(null);
            setNotice(`"${m.name}" updated.`);
            setRows((list) => list.map((x) => (x._id === m._id ? m : x)));
          }}
        />
      )}

      {farmersOf && <MeetupFarmersDialog meetup={farmersOf} onClose={() => setFarmersOf(null)} />}

      {notice && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700">
        <Search size={15} className="text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by meetup name or description"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="relative min-h-64 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        {/* Loading: a spinner centred over the table. */}
        <LoadingOverlay show={loading} />
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900/50">
            <tr>
              <th className="px-3 py-2 font-medium">Meetup</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Organizer</th>
              <th className="px-3 py-2 font-medium">Products</th>
              <th className="px-3 py-2 font-medium">Farmers</th>
              <th className="px-3 py-2 font-medium">Created by</th>
              <th className="px-3 py-2 font-medium">Created on</th>
              {canEdit && <th className="px-3 py-2 font-medium" aria-label="Actions" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {loading ? null : pageItems.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 9 : 8} className="py-12 text-center text-zinc-500">
                  <UsersRound size={22} className="mx-auto mb-2 text-zinc-400" />
                  {search ? "No meetups match this search." : canAdd ? "No meetups yet. Add the first one." : "No meetups yet."}
                </td>
              </tr>
            ) : (
              pageItems.map((m) => (
                <tr key={m._id} className="align-top">
                  <td className="px-3 py-2 font-medium">{m.name}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {m.meetupDate ? (
                      <>
                        {fmtDay(m.meetupDate)}
                        {m.meetupDate >= todayYmd() && (
                          <span className="ml-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Upcoming
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {m.village ? (
                      <>
                        <div className="font-medium">{m.village}</div>
                        <div className="text-xs text-zinc-500">{[m.taluk, m.district].filter(Boolean).join(", ")}</div>
                      </>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {m.organizer ? (
                      <>
                        <div>{m.organizer.name}</div>
                        <div className="text-xs text-zinc-500">{m.organizer.mobile}</div>
                      </>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="max-w-xs px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    <span className="line-clamp-3 whitespace-pre-line" title={m.products || m.description || undefined}>
                      {m.products || "-"}
                    </span>
                    {m.description && <div className="mt-1 line-clamp-2 text-xs text-zinc-400">{m.description}</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {/* Expected, came (filled in after), and registered from the app. */}
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      Expected <span className="font-semibold text-zinc-900 dark:text-zinc-100">{m.expectedFarmers ?? "-"}</span>
                      {" · "}
                      Visited <span className="font-semibold text-zinc-900 dark:text-zinc-100">{m.visitedFarmers ?? "-"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFarmersOf(m)}
                      className="mt-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300"
                    >
                      {m.farmerCount} registered
                    </button>
                  </td>
                  <td className="px-3 py-2">{m.createdBy?.name || <span className="text-zinc-400">-</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-600 dark:text-zinc-400">{fmtDate(m.createdAt)}</td>
                  {canEdit && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setEditingMeetup(m);
                        }}
                        aria-label={`Edit ${m.name}`}
                        title="Edit meetup"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-brand-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && rows.length > PAGE_SIZE && <Pagination {...pager} noun="meetups" />}
    </div>
  );
}
