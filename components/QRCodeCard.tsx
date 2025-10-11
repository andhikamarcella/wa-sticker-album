import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export type QRCodeCardProps = {
  url: string;
};

export function QRCodeCard({ url }: QRCodeCardProps) {
  const encodedUrl = encodeURIComponent(url);

  return (
    <Card className="flex h-full flex-col items-center gap-6 rounded-3xl border border-border/80 bg-card/80 p-6 text-center shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-lg font-semibold">Scan to open</CardTitle>
        <CardDescription className="break-all text-xs text-muted-foreground">{url}</CardDescription>
      </CardHeader>
      <CardContent className="flex w-full flex-1 flex-col items-center gap-4 pt-0">
        <div className="rounded-3xl border border-border/70 bg-white p-3 shadow-inner">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodedUrl}`}
            alt="QR code for public album"
            className="h-44 w-44 object-contain"
            width={180}
            height={180}
          />
        </div>
        <p className="text-xs text-muted-foreground">Point your camera to visit instantly.</p>
      </CardContent>
    </Card>
  );
}
