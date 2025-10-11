'use client';

import { useCallback, useEffect, useState } from 'react';

type ProfileVisibility = 'public' | 'private';
type AlbumVisibility = 'public' | 'unlisted' | 'private';

type StoredProfile = {
  displayName: string;
  bio: string;
  avatarDataUrl: string | null;
  visibility: ProfileVisibility;
  defaultAlbumVisibility: AlbumVisibility;
};

const STORAGE_KEY = 'wa-sticker-profile';
const PROFILE_EVENT = 'wa:profile-updated';

const FALLBACK_NAME = 'Sticker Fan';

function createDefaultProfile(displayName?: string): StoredProfile {
  const baseName = displayName?.trim().length ? displayName.trim() : FALLBACK_NAME;
  return {
    displayName: baseName,
    bio: '',
    avatarDataUrl: null,
    visibility: 'public',
    defaultAlbumVisibility: 'public',
  };
}

export function useProfileStorage(defaultDisplayName?: string) {
  const [profile, setProfile] = useState<StoredProfile>(() => createDefaultProfile(defaultDisplayName));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredProfile>;
        setProfile({
          ...createDefaultProfile(defaultDisplayName),
          ...parsed,
          displayName:
            typeof parsed.displayName === 'string' && parsed.displayName.trim().length > 0
              ? parsed.displayName.trim()
              : createDefaultProfile(defaultDisplayName).displayName,
          visibility:
            parsed.visibility === 'private' || parsed.visibility === 'public'
              ? parsed.visibility
              : 'public',
          defaultAlbumVisibility:
            parsed.defaultAlbumVisibility === 'public' ||
            parsed.defaultAlbumVisibility === 'unlisted' ||
            parsed.defaultAlbumVisibility === 'private'
              ? parsed.defaultAlbumVisibility
              : 'public',
        });
      } else {
        setProfile(createDefaultProfile(defaultDisplayName));
      }
    } catch {
      setProfile(createDefaultProfile(defaultDisplayName));
    } finally {
      setLoaded(true);
    }
  }, [defaultDisplayName]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue) as StoredProfile;
          setProfile(parsed);
        } catch {
          // ignore invalid payloads
        }
      }
    };

    const handleCustom = (event: Event) => {
      const detail = (event as CustomEvent<StoredProfile>).detail;
      if (detail) {
        setProfile(detail);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(PROFILE_EVENT, handleCustom as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(PROFILE_EVENT, handleCustom as EventListener);
    };
  }, []);

  const broadcast = useCallback((next: StoredProfile) => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent<StoredProfile>(PROFILE_EVENT, { detail: next }));
  }, []);

  const updateProfile = useCallback((changes: Partial<StoredProfile>) => {
    setProfile((prev) => {
      const next: StoredProfile = {
        ...prev,
        ...changes,
        displayName:
          typeof changes.displayName === 'string' && changes.displayName.trim().length > 0
            ? changes.displayName.trim()
            : prev.displayName,
      };
      broadcast(next);
      return next;
    });
  }, [broadcast]);

  const resetProfile = useCallback(() => {
    const base = createDefaultProfile(defaultDisplayName);
    setProfile(base);
    broadcast(base);
  }, [broadcast, defaultDisplayName]);

  return { profile, updateProfile, resetProfile, loaded } as const;
}

export type { StoredProfile, ProfileVisibility, AlbumVisibility };
