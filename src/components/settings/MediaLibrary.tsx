import React, { useState, useRef, useEffect } from 'react';
import { Upload, Trash2, FileText, Image, ToggleLeft, ToggleRight, Loader2, Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { Input } from '@/components/ui/input';
import { getActiveAccountId } from '@/lib/activeAccount';
import { toast } from 'sonner';

interface MediaItem {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  file_type: string;
  file_name: string | null;
  file_size: number | null;
  tags: string[];
  is_active: boolean;
  created_at: string;
}

const MediaLibrary: React.FC = () => {
  const { isAdmin } = useCompanySettings();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTags, setFormTags] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const { data } = await supabase
      .from('media_library')
      .select('*')
      .order('created_at', { ascending: false });
    setItems((data as unknown as MediaItem[]) || []);
    setLoading(false);
  };

  const handleUpload = async () => {
    if (!selectedFile || !formName) return;
    const accountId = getActiveAccountId();
    if (!accountId) {
      toast.error('Conta ativa não encontrada. Recarregue a página.');
      return;
    }
    setUploading(true);

    try {
      const ext = selectedFile.name.split('.').pop();
      const path = `library/${accountId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('media-files')
        .upload(path, selectedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('media-files')
        .getPublicUrl(path);

      const fileType = selectedFile.type.startsWith('image/') ? 'image' : 'document';
      const tags = formTags.split(',').map(t => t.trim()).filter(Boolean);

      const { error: insertError } = await supabase.from('media_library').insert({
        account_id: accountId,
        name: formName,
        description: formDescription || null,
        file_url: urlData.publicUrl,
        file_type: fileType,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        tags,
      } as any);

      if (insertError) throw insertError;

      toast.success('Arquivo adicionado à biblioteca');
      setShowForm(false);
      setFormName('');
      setFormDescription('');
      setFormTags('');
      setSelectedFile(null);
      await fetchItems();
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err?.message || 'Erro ao salvar arquivo');
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (item: MediaItem) => {
    await supabase
      .from('media_library')
      .update({ is_active: !item.is_active } as any)
      .eq('id', item.id);
    await fetchItems();
  };

  const deleteItem = async (item: MediaItem) => {
    if (!confirm(`Remover "${item.name}"?`)) return;
    await supabase.from('media_library').delete().eq('id', item.id);
    await fetchItems();
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Biblioteca de Arquivos</h3>
          <p className="text-sm text-slate-400">
            Arquivos que a DANI pode enviar automaticamente nas conversas (PDFs, catálogos, imagens).
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancelar' : 'Adicionar Arquivo'}
          </button>
        )}
      </div>

      {/* Upload form */}
      {showForm && isAdmin && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Arquivo *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-slate-600 hover:border-cyan-500 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors w-full"
            >
              <Upload className="w-5 h-5" />
              {selectedFile ? selectedFile.name : 'Clique para selecionar um arquivo'}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nome *</label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ex: Catálogo de Produtos 2026"
              className="bg-slate-900 border-slate-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Descrição (quando a DANI deve enviar)
            </label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Ex: Enviar quando o cliente pedir informações sobre preços ou catálogo"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Tags (separadas por vírgula)
            </label>
            <Input
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
              placeholder="Ex: preço, catálogo, produtos"
              className="bg-slate-900 border-slate-600"
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedFile || !formName || uploading}
            className="flex items-center gap-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Enviando...' : 'Fazer Upload'}
          </button>
        </div>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum arquivo na biblioteca ainda.</p>
          <p className="text-sm mt-1">Adicione PDFs, catálogos ou imagens para a DANI enviar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                item.is_active
                  ? 'bg-slate-800/50 border-slate-700'
                  : 'bg-slate-900/50 border-slate-800 opacity-60'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                {item.file_type === 'image' ? (
                  <Image className="w-5 h-5 text-cyan-400" />
                ) : (
                  <FileText className="w-5 h-5 text-orange-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white truncate">{item.name}</span>
                  {!item.is_active && (
                    <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-400 rounded">Inativo</span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-slate-400 truncate mt-0.5">{item.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  <span>{item.file_name}</span>
                  <span>{formatSize(item.file_size)}</span>
                  {item.tags?.length > 0 && (
                    <span className="text-cyan-500">{item.tags.join(', ')}</span>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(item)}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    title={item.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {item.is_active ? (
                      <ToggleRight className="w-5 h-5 text-green-400" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-slate-500" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteItem(item)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-slate-400 hover:text-red-400"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaLibrary;
