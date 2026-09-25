import { ComingSoon } from '../components/ComingSoon'
import { IconCrate } from '../components/icons'

export function Shop() {
  return (
    <ComingSoon
      title="Shop"
      icon={<IconCrate />}
      blurb="Cosmetic boards, building skins and token sets, delivered fresh from the foundry."
    />
  )
}
