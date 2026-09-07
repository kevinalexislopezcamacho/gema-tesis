export function CTAFooterSection() {
  return (
    <footer className="pt-20 pb-8 px-6 text-center bg-gradient-to-br from-primary to-accent">
      <div className="max-w-xl mx-auto mb-14">
        <h2 className="text-[32px] font-extrabold tracking-tight text-white mb-3.5">
          Empieza a construir tus fundamentos hoy
        </h2>
        <p className="text-[15px] text-white/85 m-0">Gratis para estudiantes y docentes de la universidad.</p>
      </div>

      <div className="max-w-[1600px] mx-auto pt-7 border-t border-white/20 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] rounded-[7px] bg-white/15 flex items-center justify-center">
            <span className="font-mono font-bold text-[11px] text-white">{"</>"}</span>
          </div>
          <span className="font-extrabold text-sm text-white">GEMA</span>
        </div>
        <p className="text-xs text-white/80 m-0 text-center">
          Kevin Alexis López Camacho · Trabajo de grado · Universidad de San Buenaventura Cali · 2026
        </p>
      </div>
    </footer>
  )
}
