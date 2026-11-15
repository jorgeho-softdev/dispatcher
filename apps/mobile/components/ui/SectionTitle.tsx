import { Text } from 'react-native';

export function SectionTitle({ title }: { title: string }) {
  return (
    <Text className="mb-2 mt-6 font-sans-semibold text-xs uppercase tracking-wider text-muted">
      {title}
    </Text>
  );
}
