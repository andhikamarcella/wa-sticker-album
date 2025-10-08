'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';

interface UploadDropzoneProps {
  albumId: string;
}

export function UploadDropzone({ albumId }: UploadDropzoneProps) {
  const { items, addFile, updateItem, clearItem } = useUploadQueue();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const mutation = useMutation({
    mutationFn: async (files: { id: string; file: File }[]) => {
      const formData = new FormData();
      files.forEach(({ file }) => formData.append('files', file));
      const response = await fetch(`/api/albums/${albumId}/stickers`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Gagal mengunggah sticker');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['album', albumId, 'stickers'] });
      showToast({ title: 'Upload berhasil', variant: 'success' });
    },
    onError: (error: unknown) => {
      showToast({ title: 'Upload gagal', description: (error as Error).message, variant: 'destructive' });
    }
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const payload = acceptedFiles.map((file) => {
        const id = addFile(file);
        updateItem(id, { status: 'uploading', progress: 5 });
        return { id, file };
      });
      mutation.mutate(payload, {
        onSuccess: () => {
          payload.forEach(({ id }) => {
            updateItem(id, { status: 'success', progress: 100 });
            setTimeout(() => clearItem(id), 1500);
          });
        },
        onError: () => {
          payload.forEach(({ id }) => updateItem(id, { status: 'error', progress: 0 }));
        }
      });
    },
    [addFile, clearItem, mutation, updateItem]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp']
    },
    multiple: true
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/70'
        }`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="h-10 w-10 text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">
          Tarik & letakkan gambar (PNG/JPG/WEBP) atau klik untuk memilih.
        </p>
        <Button type="button" variant="secondary" className="mt-4">
          Pilih File
        </Button>
      </div>
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.file.name}</span>
                <span className="text-xs text-muted-foreground">{item.status}</span>
              </div>
              <Progress value={item.progress} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
