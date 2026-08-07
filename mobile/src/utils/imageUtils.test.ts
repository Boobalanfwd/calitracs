import { getResizedCloudinaryUrl } from './imageUtils';

describe('getResizedCloudinaryUrl', () => {
  it('injects width, q_auto and c_limit after the image/upload segment', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1699999999/foodlens/food_logs/abc.jpg';
    expect(getResizedCloudinaryUrl(url, 96)).toBe(
      'https://res.cloudinary.com/demo/image/upload/w_96,q_auto,c_limit/v1699999999/foodlens/food_logs/abc.jpg'
    );
  });

  it('works for URLs without a version segment', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/foodlens/profiles/avatar.jpg';
    expect(getResizedCloudinaryUrl(url, 160)).toBe(
      'https://res.cloudinary.com/demo/image/upload/w_160,q_auto,c_limit/foodlens/profiles/avatar.jpg'
    );
  });

  it('leaves non-Cloudinary URLs untouched', () => {
    const url = 'https://images.unsplash.com/photo-1546069901?w=200&q=80';
    expect(getResizedCloudinaryUrl(url, 96)).toBe(url);
  });

  it('returns null for null/undefined input', () => {
    expect(getResizedCloudinaryUrl(null, 96)).toBeNull();
    expect(getResizedCloudinaryUrl(undefined, 96)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(getResizedCloudinaryUrl('', 96)).toBeNull();
  });
});
