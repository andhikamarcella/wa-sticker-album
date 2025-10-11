'use client';

import { type ReactNode, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  visibility: z.union([z.literal('public'), z.literal('unlisted'), z.literal('private')]).default('private'),
});

type FormValues = z.infer<typeof formSchema>;

type CreateAlbumDialogProps = {
  children?: ReactNode;
};

const visibilityOptions: { value: FormValues['visibility']; label: string; description: string }[] = [
  {
    value: 'public',
    label: 'Public',
    description: 'Visible to anyone with the link and discoverable.',
  },
  {
    value: 'unlisted',
    label: 'Unlisted',
    description: 'Accessible with the link but not listed publicly.',
  },
  {
    value: 'private',
    label: 'Private',
    description: 'Only collaborators you invite can view.',
  },
];

export function CreateAlbumDialog({ children }: CreateAlbumDialogProps) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormValues>({ name: '', visibility: 'private' });
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const mutation = useMutation({
    mutationFn: async (payload: FormValues) => {
      const response = await fetch('/api/albums', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error ?? 'Failed to create album');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      showToast({
        title: 'Album created',
        variant: 'success',
      });
      setValues({ name: '', visibility: 'private' });
      setOpen(false);
    },
    onError: (error: Error) => {
      showToast({
        title: 'Unable to create album',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = formSchema.safeParse({
      name: values.name,
      visibility: values.visibility,
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'Invalid input';
      showToast({
        title: 'Check the form',
        description: firstError,
        variant: 'destructive',
      });
      return;
    }

    mutation.mutate(parsed.data);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setValues({ name: '', visibility: 'private' });
        }
      }}
    >
      <DialogTrigger asChild>{children ?? <Button className="rounded-2xl">Create album</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new album</DialogTitle>
          <DialogDescription>Organize your stickers into a new collection.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="create-album-name" className="text-sm font-medium text-foreground">
              Album name
            </label>
            <Input
              id="create-album-name"
              value={values.name}
              onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="My sticker album"
              autoFocus
              required
              className="rounded-2xl"
              disabled={mutation.isPending}
            />
          </div>
          <div className="space-y-3">
            <span className="text-sm font-medium text-foreground">Visibility</span>
            <div className="grid gap-2">
              {visibilityOptions.map((option) => {
                const isActive = values.visibility === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      'flex flex-col rounded-2xl border border-border/70 p-3 text-left transition hover:border-border',
                      isActive && 'border-primary/60 bg-primary/10 text-primary',
                    )}
                    onClick={() => setValues((prev) => ({ ...prev, visibility: option.value }))}
                    disabled={mutation.isPending}
                  >
                    <span className="text-sm font-semibold">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="rounded-2xl"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-2xl" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create album'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
