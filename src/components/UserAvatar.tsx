import { useState } from 'react';
import type { User } from 'firebase/auth';
import { getUserPhotoURL } from '../firebase';

interface UserAvatarProps {
  user: User;
  fallbackPhotoURL?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
};

export default function UserAvatar({
  user,
  fallbackPhotoURL,
  size = 'md',
  className = '',
  onClick,
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const photoURL = getUserPhotoURL(user, fallbackPhotoURL);
  const initials = user.displayName?.charAt(0) || user.email?.charAt(0) || 'U';
  const sizeClass = sizeClasses[size];

  const sharedClass = `${sizeClass} rounded-full shrink-0 border-2 border-emerald-200 shadow-xs ${className}`;

  if (photoURL && !imageFailed) {
    const img = (
      <img
        src={photoURL}
        alt={user.displayName || 'Profile'}
        className={`${sharedClass} object-cover bg-white`}
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
      />
    );

    if (onClick) {
      return (
        <button type="button" onClick={onClick} className="rounded-full" title="Account">
          {img}
        </button>
      );
    }

    return img;
  }

  const fallback = (
    <div className={`${sharedClass} bg-emerald-600 text-white flex items-center justify-center font-bold`}>
      {initials}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="rounded-full" title="Account">
        {fallback}
      </button>
    );
  }

  return fallback;
}
