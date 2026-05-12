import { ALL_ROLES, ROLE_LABEL, ROLE_DESCRIPTION, PERMISSION_MATRIX } from "@/lib/permissions";
import { Check, Minus } from "lucide-react";

export default function AccountPermissions() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h2 className="text-lg font-semibold">Permissões por papel</h2>
        <p className="text-sm text-muted-foreground">Visão de quem pode fazer o quê na conta. Edição de papéis é feita em "Usuários".</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {ALL_ROLES.map((r) => (
          <div key={r} className="p-4 rounded-xl bg-card border border-border/40">
            <div className="text-sm font-bold mb-1">{ROLE_LABEL[r]}</div>
            <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTION[r]}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-card border border-border/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/30">
            <tr>
              <th className="text-left p-3 font-semibold">Permissão</th>
              {ALL_ROLES.map((r) => (
                <th key={r} className="text-center p-3 font-semibold whitespace-nowrap">{ROLE_LABEL[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MATRIX.flatMap((group) => [
              <tr key={`group-${group.area}`} className="bg-secondary/10">
                <td colSpan={6} className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {group.area}
                </td>
              </tr>,
              ...group.perms.map((p) => (
                <tr key={`${group.area}-${p.label}`} className="border-t border-border/30">
                  <td className="p-3">{p.label}</td>
                  {ALL_ROLES.map((r) => (
                    <td key={r} className="p-3 text-center">
                      {p.roles.includes(r) ? (
                        <Check className="w-4 h-4 text-emerald-500 inline" />
                      ) : (
                        <Minus className="w-4 h-4 text-muted-foreground/40 inline" />
                      )}
                    </td>
                  ))}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
