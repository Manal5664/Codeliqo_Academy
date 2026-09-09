import { Link } from 'react-router-dom';
import logoUrl from '../../logo.png';

export function BrandMark({ large = false }: { large?: boolean }) {
  return <Link to="/" className="inline-flex shrink-0" aria-label="Codeliqo Academy home">
    <img
      src={logoUrl}
      alt="Codeliqo Academy"
      width={1254}
      height={1254}
      className={large ? 'h-auto w-24 object-contain sm:w-28' : 'h-auto w-16 object-contain sm:w-[4.5rem]'}
    />
  </Link>;
}
