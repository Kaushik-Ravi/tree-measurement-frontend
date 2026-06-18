import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export const captureNativePhoto = async (source: CameraSource = CameraSource.Camera): Promise<File> => {
  const image = await Camera.getPhoto({
    quality: 100,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: source,
    preserveMetaData: true, // EXTREMELY IMPORTANT FOR EXIF
  });

  let rawFile: File;

  // Top 1% Tier: Bypass web browser compression/stripping by reading raw bytes directly from the native disk
  if (Capacitor.isNativePlatform() && image.path) {
    const fileResult = await Filesystem.readFile({ path: image.path });
    const base64Response = await fetch(`data:image/${image.format};base64,${fileResult.data}`);
    const rawBlob = await base64Response.blob();
    rawFile = new File([rawBlob], `photo.${image.format}`, { type: `image/${image.format}` });
  } else {
    // Fallback for local web development
    if (!image.webPath) throw new Error("No image path returned");
    const response = await fetch(image.webPath);
    const blob = await response.blob();
    rawFile = new File([blob], `photo.${image.format}`, { type: `image/${image.format}` });
  }

  return rawFile;
};
