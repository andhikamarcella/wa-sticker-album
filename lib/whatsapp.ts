interface MessageArgs {
  albumName: string;
  albumUrl: string;
}

interface UrlArgs {
  phone?: string;
  message: string;
}

export function buildWaMessage({ albumName, albumUrl }: MessageArgs) {
  return `Hai! Aku baru bikin album sticker **${albumName}** 🎉\nLihat & download: ${albumUrl}`;
}

export function buildWaUrl({ phone, message }: UrlArgs) {
  const encodedMessage = encodeURIComponent(message);
  const base = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
  return `${base}?text=${encodedMessage}`;
}
