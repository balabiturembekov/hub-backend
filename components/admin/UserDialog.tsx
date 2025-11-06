'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/UserAvatar';
import { AvatarCropDialog } from '@/components/AvatarCropDialog';
import { Upload, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/types';

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
}

export function UserDialog({ open, onOpenChange, user }: UserDialogProps) {
  const { createUser, updateUser, isLoading, currentUser } = useStore();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee' as 'SUPER_ADMIN' | 'OWNER' | 'admin' | 'employee',
    status: 'active' as 'active' | 'inactive',
    hourlyRate: '',
    avatar: '',
  });
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>('');

  // Determine available roles based on current user's role
  const getAvailableRoles = (): Array<'SUPER_ADMIN' | 'OWNER' | 'admin' | 'employee'> => {
    if (currentUser?.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can assign all roles
      return ['employee', 'admin', 'OWNER', 'SUPER_ADMIN'];
    }
    // OWNER and ADMIN can only assign EMPLOYEE and ADMIN
    return ['employee', 'admin'];
  };

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
        status: user.status,
        hourlyRate: user.hourlyRate?.toString() || '',
        avatar: user.avatar || '',
      });
      setAvatarPreview(user.avatar || '');
    } else {
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'employee',
        status: 'active',
        hourlyRate: '',
        avatar: '',
      });
      setAvatarPreview('');
    }
  }, [user, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isLoading) {
      return;
    }
    
    // Client-side validation
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Name is required',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.email.trim()) {
      toast({
        title: 'Error',
        description: 'Email is required',
        variant: 'destructive',
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const payload: any = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role.toUpperCase(),
        status: formData.status.toUpperCase(),
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      // Always include avatar - if empty string, it will remove the avatar
      payload.avatar = formData.avatar || null;

      if (formData.hourlyRate) {
        const hourlyRate = parseFloat(formData.hourlyRate);
        if (isNaN(hourlyRate) || !isFinite(hourlyRate)) {
          toast({
            title: 'Error',
            description: 'Hourly rate must be a valid number',
            variant: 'destructive',
          });
          return;
        }
        if (hourlyRate < 0) {
          toast({
            title: 'Error',
            description: 'Hourly rate cannot be negative',
            variant: 'destructive',
          });
          return;
        }
        if (hourlyRate > 10000) {
          toast({
            title: 'Error',
            description: 'Hourly rate cannot exceed $10,000',
            variant: 'destructive',
          });
          return;
        }
        payload.hourlyRate = hourlyRate;
      }

      if (user) {
        await updateUser(user.id, payload);
        toast({
          title: 'Success',
          description: 'User updated successfully',
        });
      } else {
        if (!formData.password || formData.password.length < 6) {
          toast({
            title: 'Error',
            description: 'Password is required and must be at least 6 characters',
            variant: 'destructive',
          });
          return;
        }
        await createUser(payload);
        toast({
          title: 'Success',
          description: 'User created successfully',
        });
      }
      
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to save user',
        variant: 'destructive',
      });
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast({
        title: 'Error',
        description: 'Image size must be less than 50MB',
        variant: 'destructive',
      });
      return;
    }

    // Convert to base64 and open crop dialog
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result && typeof reader.result === 'string') {
        setImageToCrop(reader.result);
        setCropDialogOpen(true);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to read image file',
          variant: 'destructive',
        });
      }
    };
    reader.onerror = () => {
      toast({
        title: 'Error',
        description: 'Failed to read image file',
        variant: 'destructive',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setFormData((prev) => ({ ...prev, avatar: '' }));
    setAvatarPreview('');
  };

  const handleCropComplete = (croppedImage: string) => {
    setFormData((prev) => ({ ...prev, avatar: croppedImage }));
    setAvatarPreview(croppedImage);
    setImageToCrop('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{user ? 'Edit User' : 'Create User'}</DialogTitle>
            <DialogDescription>
              {user ? 'Update user information' : 'Add a new user to the system'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-4">
              <UserAvatar 
                name={formData.name || 'New User'}
                avatar={avatarPreview}
                size="xl"
              />
              <div className="flex gap-2">
                <Label htmlFor="avatar" className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Photo
                    </span>
                  </Button>
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </Label>
                {avatarPreview && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={handleRemoveAvatar}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                JPG, PNG or GIF. Max size 50MB
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading || !!user}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">
                Password {user && '(leave empty to keep current)'}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!user}
                minLength={6}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role || 'employee'}
                onValueChange={(value: 'SUPER_ADMIN' | 'OWNER' | 'admin' | 'employee') =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableRoles().map((role) => (
                    <SelectItem key={role} value={role}>
                      {role === 'employee' ? 'Employee' : 
                       role === 'admin' ? 'Admin' : 
                       role === 'OWNER' ? 'Owner' : 
                       'Super Admin'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentUser?.role !== 'SUPER_ADMIN' && (
                <p className="text-xs text-muted-foreground">
                  Note: Only Employee and Admin roles can be assigned
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status || 'active'}
                onValueChange={(value: 'active' | 'inactive') =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
              <Input
                id="hourlyRate"
                type="number"
                step="0.01"
                value={formData.hourlyRate}
                onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : user ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      
      <AvatarCropDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        imageSrc={imageToCrop}
        onCropComplete={handleCropComplete}
      />
    </Dialog>
  );
}

