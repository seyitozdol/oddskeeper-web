type StateMessageProps = {
  type: "loading" | "error" | "empty";
  message: string;
};

export default function StateMessage({ type, message }: StateMessageProps) {
  if (type === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        Hata: {message}
      </div>
    );
  }

  if (type === "loading") {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm">
        {message}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
      {message}
    </div>
  );
}