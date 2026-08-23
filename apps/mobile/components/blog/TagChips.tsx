import { Pressable, ScrollView, Text } from 'react-native'
import { BLOG_TAGS, BLOG_TAG_LABELS, type BlogTag } from '@growi/shared'

/**
 * Filtre par thème, en pastilles qui défilent horizontalement.
 *
 * Tous les tags sont proposés, y compris ceux sans article : la liste est
 * courte et figée, et masquer une entrée selon le contenu du moment rendrait
 * le filtre instable d'une visite à l'autre. Un thème vide affiche son état
 * vide, ce qui est plus lisible qu'une pastille qui disparaît.
 */
export function TagChips({
  active,
  onChange,
}: {
  active?: BlogTag
  onChange: (tag?: BlogTag) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4"
      accessibilityRole="tablist"
    >
      <Chip label="Tout" selected={!active} onPress={() => onChange(undefined)} />
      {BLOG_TAGS.map((tag) => (
        <Chip
          key={tag}
          label={BLOG_TAG_LABELS[tag]}
          selected={active === tag}
          onPress={() => onChange(active === tag ? undefined : tag)}
        />
      ))}
    </ScrollView>
  )
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`Thème ${label}`}
      // 44 pt de haut : la règle vaut aussi pour une pastille.
      className={[
        'h-11 justify-center rounded-full px-4',
        selected ? 'bg-forest' : 'bg-card border border-border',
      ].join(' ')}
      style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}
    >
      <Text
        className={[
          'font-raleway-semibold text-secondary',
          selected ? 'text-sand' : 'text-forest',
        ].join(' ')}
      >
        {label}
      </Text>
    </Pressable>
  )
}
