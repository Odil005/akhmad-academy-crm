import { classifyPose, type Pose } from './domain';

let loading: Promise<typeof import('@vladmandic/face-api')> | undefined;
export function loadFaceEngine() {
  loading ??= (async () => {
    const api = await import('@vladmandic/face-api');
    await api.tf.setBackend('webgl').catch(() => api.tf.setBackend('cpu'));
    await api.tf.ready();
    await Promise.all([
      api.nets.tinyFaceDetector.loadFromUri('/face-models'),
      api.nets.faceLandmark68Net.loadFromUri('/face-models'),
      api.nets.faceRecognitionNet.loadFromUri('/face-models'),
    ]);
    return api;
  })().catch(error => { loading = undefined; throw error; });
  return loading;
}

export async function readFace(video: HTMLVideoElement): Promise<{ pose: Pose | null; descriptor: number[]; message: string } | { message: string }> {
  const api = await loadFaceEngine();
  if (video.readyState < 2 || !video.videoWidth) return { message: 'Kamera tayyorlanmoqda…' };
  const faces = await api.detectAllFaces(video, new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.7 }))
    .withFaceLandmarks().withFaceDescriptors();
  if (faces.length !== 1) return { message: faces.length > 1 ? 'Kamerada faqat bitta yuz bo‘lsin' : 'Yuzni kamera qarshisiga keltiring' };
  const face = faces[0];
  if (!face) return { message: 'Yuz topilmadi' };
  const box = face.detection.box;
  if (box.width / video.videoWidth < 0.18 || box.width / video.videoWidth > 0.75) return { message: 'Kameraga biroz yaqinlashing yoki uzoqlashing' };
  if (box.x < 5 || box.y < 5 || box.right > video.videoWidth - 5 || box.bottom > video.videoHeight - 5) return { message: 'Yuz to‘liq ko‘rinsin' };
  const points = face.landmarks.positions;
  const nose = points[30], left = points[0], right = points[16];
  if (!nose || !left || !right) return { message: 'Yuz aniq ko‘rinmayapti' };
  return { pose: classifyPose(nose.x, left.x, right.x), descriptor: Array.from(face.descriptor), message: '' };
}