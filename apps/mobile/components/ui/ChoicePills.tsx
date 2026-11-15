import { Text, TouchableOpacity, View } from 'react-native';

// Horizontal single-select pill group, used for theme/language pickers.
export function ChoicePills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <TouchableOpacity
            key={option.key}
            onPress={() => onChange(option.key)}
            className={`rounded-full border px-4 py-2 ${
              selected ? 'border-primary bg-primary' : 'border-border bg-surface'
            }`}
          >
            <Text
              className={`font-sans-semibold text-sm ${selected ? 'text-on-primary' : 'text-ink'}`}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
