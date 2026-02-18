interface AvatarProps {
  name: string;
  size?: number;
  color?: string;
}

export function Avatar({ name, size = 56, color }: AvatarProps) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const fontSize = size * 0.38;

  return (
    <div
      className="flex items-center justify-center shadow-sm"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color || '#7C81FF',
        fontSize,
      }}
    >
      <span className="font-baloo font-bold text-white">{initials}</span>
    </div>
  );
}
