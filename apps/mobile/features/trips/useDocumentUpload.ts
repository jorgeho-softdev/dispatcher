import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import type { DocumentType, UploadMimeType } from '@dispatcher/shared';
import { useCompleteTripUploadMutation, useRequestTripUploadMutation } from '@/store/api';

type Source = 'camera' | 'library';
export type UploadResult = 'uploaded' | 'cancelled' | 'denied' | 'failed';

const MIME: Record<string, UploadMimeType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};

/**
 * Photo of a document → presigned PUT straight to S3 → confirm with the api.
 * The file never passes through the api (docs/adr/0015-document-storage.md).
 */
export function useDocumentUpload(tripId: string) {
  const [uploading, setUploading] = useState(false);
  const [requestUpload] = useRequestTripUploadMutation();
  const [completeUpload] = useCompleteTripUploadMutation();

  const upload = async (type: Exclude<DocumentType, 'rate_confirmation'>, source: Source): Promise<UploadResult> => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return 'denied';

    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, exif: false };
    const picked =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = picked.canceled ? undefined : picked.assets[0];
    if (!asset) return 'cancelled';

    setUploading(true);
    try {
      const blob = await (await fetch(asset.uri)).blob();
      const ext = (asset.fileName ?? asset.uri).split('.').pop()?.toLowerCase() ?? 'jpg';
      const mimeType = MIME[ext] ?? 'image/jpeg';
      const ticket = await requestUpload({
        id: tripId,
        type,
        mimeType,
        sizeBytes: asset.fileSize ?? blob.size,
        fileName: asset.fileName ?? `${type}-${Date.now()}.${ext === 'jpeg' ? 'jpg' : ext}`,
      }).unwrap();
      const put = await fetch(ticket.uploadUrl, { method: ticket.method, headers: ticket.headers, body: blob });
      if (!put.ok) return 'failed';
      await completeUpload({ id: tripId, documentId: ticket.document.id }).unwrap();
      return 'uploaded';
    } catch {
      return 'failed';
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading };
}
