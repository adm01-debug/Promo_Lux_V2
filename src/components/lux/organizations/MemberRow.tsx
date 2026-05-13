import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCog, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { motion } from "framer-motion";
import { AppRole } from "@/hooks/useOrganizations";

const ROLE_LABEL: Record<AppRole, string> = { admin: "Admin", sdr: "SDR", viewer: "Viewer" };
const ROLE_COLOR: Record<AppRole, string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  sdr: "bg-info/15 text-info border-info/30",
  viewer: "bg-muted/30 text-muted-foreground border-border/40",
};

interface MemberRowProps {
  member: {
    id: string;
    role: AppRole;
    user_id: string;
    created_at: string;
    profile?: { full_name: string | null; avatar_url: string | null } | null;
  };
  isOwner: boolean;
  isMe: boolean;
  isAdmin: boolean;
  highlightedMemberId: string | null;
  index: number;
  onRoleChange: (member: any, role: AppRole) => void;
  onRemove: (member: any) => void;
}

export const MemberRow = ({
  member,
  isOwner,
  isMe,
  isAdmin,
  highlightedMemberId,
  index,
  onRoleChange,
  onRemove,
}: MemberRowProps) => {
  const displayName = isMe
    ? "Você"
    : member.profile?.full_name?.trim() || `${member.user_id.slice(0, 8)}…`;
  const initials = (member.profile?.full_name || member.user_id).slice(0, 2).toUpperCase();

  return (
    <motion.div
      id={`org-member-${member.id}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`p-4 flex items-center justify-between gap-3 hover:bg-secondary/20 transition-colors ${
        highlightedMemberId === member.id ? "bg-primary/10 ring-1 ring-primary/40" : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-9 w-9 flex-shrink-0 border border-border/40">
          {member.profile?.avatar_url && <AvatarImage src={member.profile.avatar_url} alt={displayName} />}
          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
            {member.profile?.full_name ? initials : <UserCog className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {displayName}
            {isMe && <span className="ml-1.5 text-[10px] text-muted-foreground">(você)</span>}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Entrou em {new Date(member.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isOwner && (
          <Badge variant="outline" className="text-[10px] gap-1 bg-primary/15 border-primary/30 text-primary">
            <Shield className="h-3 w-3" /> Owner
          </Badge>
        )}
        
        {isAdmin && !isOwner ? (
          <Select
            value={member.role}
            onValueChange={(v) => onRoleChange(member, v as AppRole)}
          >
            <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="sdr">SDR</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline" className={`text-[10px] ${ROLE_COLOR[member.role]}`}>
            {ROLE_LABEL[member.role]}
          </Badge>
        )}

        {(isAdmin && !isOwner) || isMe ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            disabled={isOwner}
            onClick={() => onRemove(member)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </motion.div>
  );
};
