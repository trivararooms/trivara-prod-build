import { RefObject } from 'react';
import { Image } from 'lucide-react';
import { ListingFormData } from './types';

interface PhotosStepProps {
  formData: ListingFormData;
  fileInputRef: RefObject<HTMLInputElement>;
  onAddPhotos: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (index: number) => void;
}

export function PhotosStep({ formData, fileInputRef, onAddPhotos, onFileChange, onRemovePhoto }: PhotosStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-medium mb-2">Add photos</h2>
        <p className="text-text-secondary">Photos help guests imagine staying at your place</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {formData.photos.map((photo, idx) => (
          <div key={idx} className="aspect-[4/3] rounded-lg overflow-hidden bg-surface-0 border border-border relative group">
            <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onRemovePhoto(idx)}
              className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddPhotos}
          className="aspect-[4/3] rounded-lg border border-dashed border-border bg-card hover:bg-surface-3 trivara-transition flex flex-col items-center justify-center gap-2"
        >
          <Image className="h-8 w-8 text-text-secondary" />
          <span className="text-sm text-text-secondary">Add photos</span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept="image/*"
          onChange={onFileChange}
          className="hidden"
        />
      </div>
      {formData.photos.length === 0 && (
        <div className="text-sm text-destructive">
          At least one photo is required to save a listing draft
        </div>
      )}
    </div>
  );
}
