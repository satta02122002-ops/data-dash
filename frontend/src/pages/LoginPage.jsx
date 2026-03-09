import React from 'react';
import { AuthLayout, LoginForm } from '../components/auth/AuthForm';

export default function LoginPage() {
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your account to continue">
      <LoginForm />
    </AuthLayout>
  );
}
