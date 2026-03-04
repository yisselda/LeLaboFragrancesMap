export default function Header() {
  return (
    <header className="header">
      <div className="header-row">
        <div className="header-brand">
          <img
            className="header-bottle"
            src={`${import.meta.env.BASE_URL}icons/big-bottle.png`}
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
          />
          <div className="header-copy">
            <div className="header-title">Le Labo City Exclusives</div>
            <div className="header-disclaimer">
              This is an independent project. Not affiliated with Le Labo.
            </div>
          </div>
        </div>
        <a
          className="header-about"
          href="https://github.com/yisselda/LeLaboFragrancesMap"
          target="_blank"
          rel="noreferrer"
        >
          About
        </a>
      </div>
    </header>
  );
}
