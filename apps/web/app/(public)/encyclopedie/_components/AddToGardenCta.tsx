import Link from 'next/link'

export function AddToGardenCta({ catalogId }: { catalogId: string }) {
  return (
    <Link
      href={`/dashboard/plantes/quick-add?catalogId=${catalogId}`}
      className="block w-full rounded-xl bg-lime hover:bg-lime-hover text-forest font-poppins font-semibold text-sm text-center py-3 shadow-cta transition-all hover:-translate-y-0.5"
    >
      + Ajouter à mon jardin
    </Link>
  )
}
