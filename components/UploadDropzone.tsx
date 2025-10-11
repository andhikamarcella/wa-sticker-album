'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface UploadDropzoneProps {
  albumId: string;
}

type UploadPayload = { id: string; file: File };

type UploadResponse = unknown;

const ACCEPTED_TYPES: Record<string, string[]> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

function uploadWithProgress(
  url: string,
  files: UploadPayload[],
  onProgress: (percent: number) => void,
): Promise<UploadResponse> {
  const formData = new FormData();
  files.forEach(({ file }) => {
    formData.append('files', file, file.name);
  });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.responseType = 'json';

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress(percent);
      } else {
        onProgress(50);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response ?? {});
        return;
      }

      const message =
        (xhr.response && typeof xhr.response === 'object' && 'error' in xhr.response
          ? (xhr.response as { error?: string }).error
          : undefined) ?? xhr.statusText ?? 'Upload gagal';
      reject(new Error(message));
    };

    xhr.onerror = () => {
      reject(new Error('Tidak dapat mengunggah file.'));
    };

    xhr.send(formData);
  });
}

export function UploadDropzone({ albumId }: UploadDropzoneProps) {
  const { items, addFile, updateItem, clearItem } = useUploadQueue();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const mutation = useMutation<UploadResponse, Error, UploadPayload[]>({
    mutationFn: async (payload) => {
      payload.forEach(({ id }) => {
        updateItem(id, { status: 'uploading', progress: 5, error: undefined });
      });

      const result = await uploadWithProgress(`/api/albums/${albumId}/stickers`, payload, (percent) => {
        payload.forEach(({ id }) => {
          updateItem(id, { progress: Math.max(percent, 5), status: 'uploading' });
        });
      });

      payload.forEach(({ id }) => {
        updateItem(id, { status: 'success', progress: 100 });
        setTimeout(() => {
          clearItem(id);
        }, 1500);
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['album', albumId, 'stickers'] });
      showToast({ title: 'Sticker berhasil diunggah', variant: 'success' });
    },
    onError: (error, variables) => {
      const message = error.message || 'Gagal mengunggah sticker';
      variables?.forEach(({ id }) => {
        updateItem(id, { status: 'error', progress: 0, error: message });
      });
      showToast({ title: 'Upload gagal', description: message, variant: 'destructive' });
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) {
        return;
      }

      const payload = acceptedFiles.map((file) => ({ id: addFile(file), file }));
      mutation.mutate(payload);
    },
    [addFile, mutation],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    multiple: true,
    maxSize: MAX_FILE_SIZE_BYTES,
    onDropRejected: (rejections) => {
      rejections.forEach((rejection) => {
        const message = rejection.errors.map((error) => error.message).join(', ');
        showToast({
          title: rejection.file.name,
          description: message || 'File tidak dapat diunggah',
          variant: 'destructive',
        });
      });
    },
  });

  const isUploading = mutation.isPending;

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed bg-card p-8 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/70',
          isUploading && 'pointer-events-none opacity-70',
        )}
      >
        <input {...getInputProps()} disabled={isUploading} />
        <UploadCloud className="h-10 w-10 text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">
          Tarik & jatuhkan gambar (PNG, JPG, WEBP) atau klik untuk memilih file.
        </p>
        <Button type="button" variant="secondary" className="mt-4" disabled={isUploading}>
          Pilih File
        </Button>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate font-medium">{item.file.name}</span>
                <span className="text-xs capitalize text-muted-foreground">{item.status}</span>
              </div>
              <div className="mt-2">
                <Progress value={item.progress} />
              </div>
              {item.error && <p className="mt-2 text-xs text-destructive">{item.error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
