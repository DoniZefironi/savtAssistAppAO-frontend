// Мелкие иконки, использующиеся в 3+ не связанных друг с другом местах
// приложения — раньше каждая была скопирована в свой файл заново. Не полный
// набор: часть похожих иконок (Trash/Pencil/Chevron*/X) сознательно оставлена
// как есть — у их копий разный набор пропсов и толщина линии (strokeWidth
// 1.5/2/2.5 в разных местах, где-то фиксированный размер без className) —
// это уже не случайное дублирование, а разошедшиеся варианты, слепое
// объединение которых незаметно поменяло бы вид иконок в части экранов.
export function SearchIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
}

export function SpinnerIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
}
