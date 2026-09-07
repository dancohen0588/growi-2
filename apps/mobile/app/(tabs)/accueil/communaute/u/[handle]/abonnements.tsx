import { useLocalSearchParams } from 'expo-router'

import { FollowList } from '@/components/community/FollowList'

export default function AbonnementsScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  return <FollowList handle={handle ?? ''} direction="following" />
}
