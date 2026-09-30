export function ErrorBox({ message, errors }: { message: string; errors?: Record<string, string> }) {
  const list = errors ? Object.values(errors) : [];
  return (
    <div className="vm-alert" role="alert">
      <strong>*** ERROR ***</strong>
      {message}
      {list.length > 0 && (
        <ul>
          {list.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
