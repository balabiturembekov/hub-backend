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
import { useToast } from '@/hooks/use-toast';
import { Upload, X } from 'lucide-react';

interface ProfileEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileEditDialog({ open, onOpenChange }: ProfileEditDialogProps) {
  const { currentUser, updateMyProfile, isLoading } = useStore();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    hourlyRate: '',
    avatar: '',
  });
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>('');

  useEffect(() => {
    if (currentUser && open) {
      // Reset form data when dialog opens
      setFormData({
        name: currentUser.name,
        email: currentUser.email,
        hourlyRate: currentUser.hourlyRate?.toString() || '',
        avatar: currentUser.avatar || '',
      });
      setAvatarPreview(currentUser.avatar || '');
      // Reset crop dialog state
      setCropDialogOpen(false);
      setImageToCrop('');
    } else if (!open) {
      // Cleanup when dialog closes
      setCropDialogOpen(false);
      setImageToCrop('');
    }
  }, [currentUser, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

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
      };

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

      await updateMyProfile(payload);
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to update profile',
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
    // Reset file input to allow re-uploading the same file
    const fileInput = document.getElementById('avatar') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleCropComplete = (croppedImage: string) => {
    setFormData((prev) => ({ ...prev, avatar: croppedImage }));
    setAvatarPreview(croppedImage);
    setImageToCrop('');
  };

  if (!currentUser) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your profile information
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-4">
              <UserAvatar 
                name={formData.name || currentUser.name}
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
              <Label htmlFor="name">Full Name</Label>
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
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hourlyRate">Hourly Rate ($/hr)</Label>
              <Input
                id="hourlyRate"
                type="number"
                step="0.01"
                min="0"
                value={formData.hourlyRate}
                onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                disabled={isLoading}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
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

