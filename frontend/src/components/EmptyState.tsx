type Props = {
  heading: string
  body: string
}

export function EmptyState({ heading, body }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-[#1e1e1e] bg-[#111111] px-6 py-16 text-center">
      <h2 className="text-lg font-medium text-[#e8e8e8]">{heading}</h2>
      <p className="mt-2 max-w-md text-sm text-[#6b6b6b]">{body}</p>
    </div>
  )
}
