import { useState } from 'react';
import { Home, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ListingGalleryProps {
  title: string;
  photos: string[] | undefined;
}

/** Photo grid (hero + up to 4 thumbnails) with a click-through lightbox dialog. */
export function ListingGallery({ title, photos }: ListingGalleryProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const openAt = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  return (
    <>
      <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        <button
          type="button"
          className="lg:col-span-2 lg:row-span-2 block cursor-pointer"
          onClick={() => openAt(0)}
          disabled={!photos?.[0]}
        >
          {photos && photos[0] ? (
            <img
              src={photos[0]}
              alt={title}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <div className="w-full h-full bg-surface-2 rounded-lg flex items-center justify-center min-h-96">
              <div className="text-center text-text-secondary">
                <Home className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No image available</p>
              </div>
            </div>
          )}
        </button>
        {photos && photos.slice(1, 5).map((photo: string, index: number) => (
          <button
            type="button"
            key={index}
            className="aspect-square block cursor-pointer"
            onClick={() => openAt(index + 1)}
          >
            <img
              src={photo}
              alt={`${title} ${index + 2}`}
              className="w-full h-full object-cover rounded-lg"
            />
          </button>
        ))}
        {photos && photos.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            className="absolute bottom-3 right-3 bg-background/90"
            onClick={() => openAt(0)}
          >
            Show all {photos.length} photos
          </Button>
        )}
      </div>

      {/* Photo Lightbox */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-4xl w-full bg-background p-0 overflow-hidden">
          {photos && photos.length > 0 && (
            <div className="relative bg-black/90 flex items-center justify-center h-[70vh]">
              <img
                src={photos[galleryIndex]}
                alt={`${title} ${galleryIndex + 1}`}
                className="max-h-full max-w-full object-contain"
              />
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setGalleryIndex((i) => (i - 1 + photos.length) % photos.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 hover:bg-background flex items-center justify-center"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setGalleryIndex((i) => (i + 1) % photos.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 hover:bg-background flex items-center justify-center"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white bg-black/60 px-2 py-1 rounded-full">
                    {galleryIndex + 1} / {photos.length}
                  </span>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
