import { Button } from "@ui/base/ui/button"
import { Checkbox } from "@ui/base/ui/checkbox"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import Link from "next/link"

type SignInFormProps = {
  error?: string
  next?: string
}

export function SignInForm({ error, next = "/" }: SignInFormProps) {
  return (
    <div className="grid gap-6">
      {error && (
        <div role="alert" className="rounded-md bg-red-100 p-4 text-sm text-red-900">
          {error}
        </div>
      )}

      <form action="/login/credentials" method="post" className="grid gap-4">
        <input type="hidden" name="intent" value="register" />
        <input type="hidden" name="next" value={next} />
        <div className="grid gap-2">
          <Label htmlFor="register-username">Username</Label>
          <Input
            id="register-username"
            name="username"
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_-]+"
            autoComplete="username"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-password">Password</Label>
          <Input
            id="register-password"
            name="password"
            type="password"
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox id="register-terms" name="terms" required />
          <Label htmlFor="register-terms" className="text-sm leading-5">
            I agree to the{" "}
            <Link href="/legal/community-terms" className="text-blue-600 hover:underline">
              Terms of Service
            </Link>
            ,{" "}
            <Link href="/legal/privacy-policy" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>
            , and{" "}
            <Link href="/legal/code-of-conduct" className="text-blue-600 hover:underline">
              Community Code of Conduct
            </Link>
          </Label>
        </div>
        <Button type="submit">Create account</Button>
        <p className="text-center text-xs text-muted-foreground">
          Your account is signed in immediately after registration.
        </p>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Already registered?</span>
        </div>
      </div>

      <form action="/login/credentials" method="post" className="grid gap-4">
        <input type="hidden" name="intent" value="sign-in" />
        <input type="hidden" name="next" value={next} />
        <div className="grid gap-2">
          <Label htmlFor="sign-in-username">Username</Label>
          <Input
            id="sign-in-username"
            name="username"
            minLength={3}
            maxLength={24}
            autoComplete="username"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sign-in-password">Password</Label>
          <Input
            id="sign-in-password"
            name="password"
            type="password"
            minLength={10}
            maxLength={128}
            autoComplete="current-password"
            required
          />
        </div>
        <Button variant="outline" type="submit">
          Sign in
        </Button>
      </form>
    </div>
  )
}
