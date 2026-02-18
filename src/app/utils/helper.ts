export function maskPhoneNumber(phoneNumber: string): string {
  // mask phone number, showing only first 4 and last 2 digits
  if (phoneNumber.length <= 6) {
    return phoneNumber;
  }

  // get first 4 and last 2 digits
  const lastTwo = phoneNumber.slice(-2);
  const firstFour = phoneNumber.slice(0, 4);
  const maskedMiddle = phoneNumber.slice(4, -2).replace(/\d/g, '*');

  // return masked phone number
  return firstFour + maskedMiddle + lastTwo;
}

export function maskEmail(email: string): string {
  // mask email, showing only first 2 and last 2 characters before @, then the domain
  const atIndex = email.indexOf('@');

  // if no @ found, return as is
  if (atIndex === -1) {
    return email;
  }

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex);

  // if local part is 4 characters or less, return as is
  if (localPart.length <= 4) {
    return email;
  }

  // get first 2 and last 2 characters of local part
  const firstTwo = localPart.slice(0, 2);
  const lastTwo = localPart.slice(-2);
  const maskedMiddle = localPart.slice(2, -2).replace(/./g, '*');

  // return masked email
  return firstTwo + maskedMiddle + lastTwo + domain;
}

export function getImageUrlOrDefault(imageUrl = '', defaultSvgPath = 'assets/images/profile.jpeg'): string {
  // return default SVG if image URL is null, undefined, empty, or invalid
  if (!imageUrl || (typeof imageUrl === 'string' && imageUrl.trim() === '')) {
    return defaultSvgPath;
  }

  // check if URL is valid (basic validation)
  try {
    new URL(imageUrl);
    return imageUrl;
  } catch {
    // if URL is invalid, return default SVG
    return defaultSvgPath;
  }
}

export function onImageError(event: Event, defaultImagePath = 'assets/images/profile.jpeg'): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const img = event.target as HTMLImageElement;

  // hide the failed image
  img.style.display = 'none';

  // get the fallback div (next sibling) or create it if it doesn't exist
  let fallback = img.nextElementSibling as HTMLElement;

  // if fallback doesn't exist, create it
  if (!fallback || !fallback.classList.contains('image-error-fallback')) {
    fallback = document.createElement('div');
    fallback.className = 'absolute inset-0 bg-neutral-06 hidden image-error-fallback';

    // get border radius from image if it has one
    const imgStyle = window.getComputedStyle(img);
    const borderRadius = imgStyle.borderRadius;
    if (borderRadius && borderRadius !== '0px') {
      fallback.style.borderRadius = borderRadius;
    }

    // insert after the image
    img.parentElement?.insertBefore(fallback, img.nextSibling);
  }

  // ensure grey background is set (neutral-06 color)
  fallback.style.backgroundColor = 'var(--neutral-06)';

  // if default image path is provided, set it as background image
  if (defaultImagePath) {
    fallback.style.backgroundImage = `url(${defaultImagePath})`;
    fallback.style.backgroundSize = 'cover';
    fallback.style.backgroundPosition = 'center';
  }

  // show the fallback div
  fallback.classList.remove('hidden');
}

export function extractUsernameFromQR(decodedText: string): string | null {
  if (!decodedText) return null;

  const value = decodedText.trim();

  if (value.startsWith('http')) {
    try {
      const url = new URL(value);
      const pathSegments = url.pathname.split('/').filter(Boolean);
      return pathSegments[0] || null;
    } catch {
      return null;
    }
  }
  return value || null;
}
