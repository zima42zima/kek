import { APP_NAME } from '../../lib/brand'

/** B&W postal stamp mark for owl letters */
export default function OwlPostStamp({ className = '' }) {
  return (
    <div className={`owl-post-stamp ${className}`} aria-hidden>
      <span className="owl-post-stamp__ring">
        <span className="owl-post-stamp__top">OWL POST</span>
        <span className="owl-post-stamp__mid">{APP_NAME}</span>
        <span className="owl-post-stamp__bottom">SEALED</span>
      </span>
    </div>
  )
}
