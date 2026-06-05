'use client';

import { useMemo, useState } from 'react';
import { X, Trash2, Download, ClipboardList, Upload, Camera, Loader2 } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { parseMenuList } from '@/lib/menu/parse-list';
import { parseMenuCsv, MENU_CSV_TEMPLATE } from '@/lib/menu/parse-csv';
import { bulkInsertMenu, type BulkRow } from '@/lib/menu/bulk-insert';

type Tab = 'paste' | 'csv' | 'photo';

export function BulkImportSheet({
  tenantId,
  categories,
  onClose,
  onDone,
}: {
  tenantId: string;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<Tab>('paste');
  const [pasteText, setPasteText] = useState('');
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [edited, setEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [err, setErr] = useState('');

  const defaultCategory = categories[0]?.name || 'Main Dishes';

  const parsedFromPaste = useMemo<BulkRow[]>(() => {
    return parseMenuList(pasteText, defaultCategory).flatMap((s) =>
      s.items.map((it) => ({
        name: it.name,
        price: it.price,
        description: it.description,
        category: s.category || defaultCategory,
        chopBar: it.chopBar,
      }))
    );
  }, [pasteText, defaultCategory]);

  const previewRows = edited ? rows : tab === 'paste' ? parsedFromPaste : rows;
  const validCount = previewRows.filter((r) => r.name.trim() && r.price >= 0).length;

  function startEditing() {
    if (!edited) {
      setRows(previewRows);
      setEdited(true);
    }
  }
  function updateRow(i: number, patch: Partial<BulkRow>) {
    startEditing();
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i: number) {
    startEditing();
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function downloadTemplate() {
    const blob = new Blob(['﻿' + MENU_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'menu-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCsvFile(file: File) {
    const text = await file.text();
    const csvRows = parseMenuCsv(text).map((r) => ({
      name: r.name,
      price: r.price,
      description: r.description,
      category: r.category || defaultCategory,
      chopBar: r.chopBar,
    }));
    setRows(csvRows);
    setEdited(true);
  }

  async function handlePhoto(file: File) {
    setExtracting(true);
    setErr('');
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const res = await fetch('/api/menu/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64, mediaType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read the menu.');
      const mapped: BulkRow[] = (data.sections || []).flatMap(
        (s: { category: string | null; items: { name: string; price: number; description?: string }[] }) =>
          (s.items || []).map((it) => ({
            name: it.name,
            price: Number(it.price) || 0,
            description: it.description || undefined,
            category: s.category || defaultCategory,
          }))
      );
      setRows(mapped);
      setEdited(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not read the menu.');
    } finally {
      setExtracting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setErr('');
    try {
      const supabase = createBrowserClient();
      await bulkInsertMenu(supabase, tenantId, previewRows);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add dishes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[92dvh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline shrink-0">
          <h2 className="text-lg font-bold text-surface-900">Add many dishes</h2>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface-100" aria-label="Close">
            <X className="w-5 h-5 text-surface-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 pt-3 shrink-0">
          {([['paste', 'Paste', ClipboardList], ['csv', 'Upload', Upload], ['photo', 'Photo', Camera]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setEdited(false); }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold ${tab === key ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-600'}`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin">
          {tab === 'paste' && (
            <div className="space-y-2">
              <p className="text-xs text-surface-500">
                One dish per line, e.g. <span className="font-mono">Jollof Rice 45</span>. A line with no price becomes a category. Add <span className="font-mono">(chop bar)</span> to a dish to make it build-your-own.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => { setPasteText(e.target.value); setEdited(false); }}
                rows={6}
                placeholder={'DRINKS\nSobolo 10\nWater 5\n\nMAINS\nJollof Rice 45\nWaakye 35'}
                className="w-full px-4 py-3 rounded-xl border border-hairline bg-white text-surface-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
            </div>
          )}

          {tab === 'csv' && (
            <div className="space-y-3">
              <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                <Download className="w-4 h-4" /> Download template
              </button>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }}
                className="block w-full text-sm text-surface-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-500/10 file:text-brand-600"
              />
            </div>
          )}

          {tab === 'photo' && (
            <div className="space-y-3">
              <p className="text-xs text-surface-500">
                Snap or upload a photo of a printed menu. We&apos;ll read the dishes and prices into the preview for you to check.
              </p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }}
                disabled={extracting}
                className="block w-full text-sm text-surface-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-500/10 file:text-brand-600 disabled:opacity-50"
              />
              {extracting && (
                <p className="inline-flex items-center gap-2 text-sm text-surface-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Reading your menu…
                </p>
              )}
            </div>
          )}

          {/* Preview */}
          {previewRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-surface-400 uppercase tracking-widest">Preview — edit before adding</p>
              <div className="space-y-2">
                {previewRows.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={r.name}
                      onChange={(e) => updateRow(i, { name: e.target.value })}
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-hairline text-sm"
                      placeholder="Dish name"
                    />
                    <input
                      value={r.price}
                      onChange={(e) => updateRow(i, { price: parseFloat(e.target.value) || 0 })}
                      type="number"
                      step="0.01"
                      className="w-20 px-2 py-2 rounded-lg border border-hairline text-sm"
                    />
                    <select
                      value={r.category}
                      onChange={(e) => updateRow(i, { category: e.target.value })}
                      className="w-24 px-2 py-2 rounded-lg border border-hairline text-sm"
                    >
                      {Array.from(new Set([r.category, ...categories.map((c) => c.name)])).filter(Boolean).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-[10px] font-semibold text-surface-500 shrink-0 cursor-pointer" title="Chop bar (build-your-own) — add options after">
                      <input
                        type="checkbox"
                        checked={!!r.chopBar}
                        onChange={(e) => updateRow(i, { chopBar: e.target.checked })}
                        className="w-3.5 h-3.5 rounded"
                        style={{ accentColor: '#FF6B35' }}
                      />
                      Chop
                    </label>
                    <button onClick={() => removeRow(i)} className="p-2 text-surface-400 hover:text-error-600" aria-label="Remove">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {err && <p className="text-sm text-error-600">{err}</p>}
        </div>

        <div className="border-t border-hairline px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shrink-0">
          <Button onClick={handleSave} loading={saving} disabled={validCount === 0} className="w-full">
            {saving ? 'Adding…' : `Add ${validCount} dish${validCount === 1 ? '' : 'es'}`}
          </Button>
        </div>
      </div>
    </>
  );
}
