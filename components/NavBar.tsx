'use client';

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Globe2, Link2, Loader2, Lock, Search, Trash2 } from 'lucide-react';

import { useProfileStorage } from '@/hooks/useProfileStorage';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

export type NavBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  userLabel?: string | null;
};

type VisibilityOption<T extends string> = {
  value: T;
  label: string;
  description: string;
  icon: JSX.Element;
};

const profileVisibilityOptions: VisibilityOption<'public' | 'private'>[] = [
  {
    value: 'public',
    label: 'Public profile',
    description: 'Your name and avatar are visible to anyone with your shared album links.',
    icon: <Globe2 className="h-4 w-4" aria-hidden />,
  },
  {
    value: 'private',
    label: 'Private profile',
    description: 'Only collaborators you invite can see your profile details.',
    icon: <Lock className="h-4 w-4" aria-hidden />,
  },
];

const albumVisibilityOptions: VisibilityOption<'public' | 'unlisted' | 'private'>[] = [
  {
    value: 'public',
    label: 'Public albums',
    description: 'Albums are discoverable and can be shared broadly.',
    icon: <Globe2 className="h-4 w-4" aria-hidden />,
  },
  {
    value: 'unlisted',
    label: 'Unlisted by default',
    description: 'Albums require a link but are not listed publicly.',
    icon: <Link2 className="h-4 w-4" aria-hidden />,
  },
  {
    value: 'private',
    label: 'Private albums',
    description: 'Albums start locked and only collaborators can access them.',
    icon: <Lock className="h-4 w-4" aria-hidden />,
  },
];

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB

export function NavBar({ searchValue, onSearchChange, userLabel }: NavBarProps) {
  const { showToast } = useToast();
  const [profileOpen, setProfileOpen] = useState(false);
  const { profile, updateProfile, resetProfile, loaded } = useProfileStorage(userLabel ?? undefined);

  const displayName = useMemo(() => {
    if (!loaded) {
      return userLabel?.trim() || undefined;
    }
    return profile.displayName.trim() || userLabel?.trim() || undefined;
  }, [loaded, profile.displayName, userLabel]);

  const initials = useMemo(() => {
    const source = displayName ?? userLabel?.trim();
    if (!source || source.length === 0) return '?';
    const [firstWord] = source.split(/\s+/);
    return firstWord?.charAt(0)?.toUpperCase() || '?';
  }, [displayName, userLabel]);

  const [draftName, setDraftName] = useState('');
  const [draftBio, setDraftBio] = useState('');
  const [draftVisibility, setDraftVisibility] = useState<'public' | 'private'>('public');
  const [draftAlbumVisibility, setDraftAlbumVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!profileOpen || !loaded) return;
    setDraftName(profile.displayName);
    setDraftBio(profile.bio);
    setDraftVisibility(profile.visibility);
    setDraftAlbumVisibility(profile.defaultAlbumVisibility);
    setDraftAvatar(profile.avatarDataUrl);
    setAvatarError(null);
  }, [profileOpen, loaded, profile]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('Choose an image under 2MB for the best performance.');
      return;
    }

    setAvatarError(null);
    setAvatarLoading(true);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') setDraftAvatar(result);
      setAvatarLoading(false);
    };
    reader.onerror = () => {
      setAvatarLoading(false);
      setAvatarError('Unable to read the selected file. Please try another image.');
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarRemove = () => {
    setDraftAvatar(null);
    setAvatarError(null);
  };

  const handleAvatarPick = () => {
    fileInputRef.current?.click();
  };

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loaded) return;

    const trimmedName = draftName.trim();
    const fallbackName = displayName ?? userLabel?.trim() ?? 'Sticker Fan';
    updateProfile({
      displayName: trimmedName.length > 0 ? trimmedName : fallbackName,
      bio: draftBio.trim(),
      avatarDataUrl: draftAvatar,
      visibility: draftVisibility,
      defaultAlbumVisibility: draftAlbumVisibility,
    });

    showToast({
      title: 'Profile updated',
      description: 'Your details and album defaults are now saved.',
      variant: 'success',
    });
    setProfileOpen(false);
  };

  const handleResetProfile = () => {
    resetProfile();
    showToast({
      title: 'Profile reset',
      description: 'Reverted to the default profile preferences.',
      variant: 'success',
    });
    setProfileOpen(false);
  };

  const avatarPreview = draftAvatar ?? (loaded ? profile.avatarDataUrl : null);

  const avatarNode = avatarPreview ? (
    <div className="h-10 w-10 overflow-hidden rounded-full border border-border/40">
      <img src={avatarPreview} alt="Profile avatar" className="h-full w-full object-cover" />
    </div>
  ) : (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
      {initials}
    </div>
  );

  const profileVisibilityLabel = loaded ? (profile.visibility === 'private' ? 'Private' : 'Public') : undefined;

  return (
    <header className="w-full px-4 py-4">
      <div
        className={cn(
          'mx-auto flex w-full max-w-6xl flex-col gap-4 rounded-3xl border border-border bg-card/80 p-3 shadow-sm backdrop-blur-sm transition-colors sm:p-4',
          'md:flex-row md:items-center md:justify-between md:gap-6',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">Sticker Album</span>
            <span className="text-xs text-muted-foreground">Organize and share your WhatsApp stickers</span>
            {displayName ? (
              <span className="mt-1 text-xs font-medium text-foreground/70">
                Hi, {displayName}
                {profileVisibilityLabel ? ` · ${profileVisibilityLabel} profile` : ''}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border/40 bg-muted/40 text-sm font-medium text-muted-foreground transition hover:border-border hover:bg-muted"
              aria-label="Open profile settings"
            >
              {avatarNode}
            </button>
          </div>
        </div>
        <form
          onSubmit={handleSearchSubmit}
          className="flex w-full flex-col gap-3 sm:flex-1 sm:flex-row sm:items-center sm:gap-4"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={handleSearchChange}
              placeholder="Search albums"
              className="h-11 rounded-2xl border-border pl-10"
              aria-label="Search albums"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border/40 bg-muted/40 text-sm font-medium text-muted-foreground transition hover:border-border hover:bg-muted"
              aria-label="Open profile settings"
            >
              {avatarNode}
            </button>
          </div>
        </form>
      </div>

        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogContent className="max-h-[calc(100vh-2rem)] w-full max-w-[calc(100vw-2rem)] overflow-y-auto rounded-3xl p-0 sm:max-h-none sm:max-w-xl sm:p-6">
            <DialogHeader className="px-4 pt-4 sm:px-0 sm:pt-0">
              <DialogTitle>Profile & defaults</DialogTitle>
              <DialogDescription>
                Personalize your profile photo, bio, and default album visibility before sharing to WhatsApp.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 px-4 pb-6 sm:px-0">
            {!loaded ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-20 w-20 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-10 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ) : (
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="relative h-20 w-20 overflow-hidden rounded-full border border-dashed border-border">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Profile avatar preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-lg font-semibold text-muted-foreground">
                        {initials}
                      </div>
                    )}
                    {avatarLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/80">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">Profile photo</p>
                      <p className="text-xs text-muted-foreground">
                        Upload a square image (PNG, JPG, WEBP) under 2MB for the best sharing preview.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={handleAvatarChange}
                      />
                      <Button type="button" className="rounded-2xl gap-2" variant="outline" onClick={handleAvatarPick}
                        aria-label="Upload a new profile photo"
                      >
                        <Camera className="h-4 w-4" aria-hidden />
                        Upload photo
                      </Button>
                      {avatarPreview ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="rounded-2xl text-destructive hover:text-destructive"
                          onClick={handleAvatarRemove}
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                          Remove
                        </Button>
                      ) : null}
                    </div>
                    {avatarError ? <p className="text-xs text-destructive">{avatarError}</p> : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="profile-name" className="text-sm font-semibold text-foreground">
                    Display name
                  </label>
                  <Input
                    id="profile-name"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    placeholder="Your name"
                    className="rounded-2xl"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="profile-bio" className="text-sm font-semibold text-foreground">
                    Bio
                  </label>
                  <Textarea
                    id="profile-bio"
                    value={draftBio}
                    onChange={(event) => setDraftBio(event.target.value)}
                    placeholder="Tell collaborators about this sticker collection."
                    className="min-h-[120px] rounded-2xl"
                  />
                </div>

                <div className="space-y-3">
                  <span className="text-sm font-semibold text-foreground">Profile visibility</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {profileVisibilityOptions.map((option) => {
                      const active = draftVisibility === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDraftVisibility(option.value)}
                          className={cn(
                            'flex flex-col gap-1 rounded-2xl border border-border/70 p-3 text-left transition hover:border-border',
                            active && 'border-primary/60 bg-primary/10 text-primary',
                          )}
                          aria-pressed={active}
                          aria-label={`Set profile visibility to ${option.label}`}
                        >
                          <span className="flex items-center gap-2 text-sm font-semibold">
                            {option.icon}
                            {option.label}
                          </span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-sm font-semibold text-foreground">Default album visibility</span>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {albumVisibilityOptions.map((option) => {
                      const active = draftAlbumVisibility === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDraftAlbumVisibility(option.value)}
                          className={cn(
                            'flex flex-col gap-1 rounded-2xl border border-border/70 p-3 text-left transition hover:border-border',
                            active && 'border-primary/60 bg-primary/10 text-primary',
                          )}
                          aria-pressed={active}
                          aria-label={`Set default album visibility to ${option.label}`}
                        >
                          <span className="flex items-center gap-2 text-sm font-semibold">
                            {option.icon}
                            {option.label}
                          </span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="button" variant="ghost" className="rounded-2xl text-sm" onClick={handleResetProfile}>
                    Reset to defaults
                  </Button>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" variant="ghost" className="rounded-2xl" onClick={() => setProfileOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="rounded-2xl">
                      Save changes
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
