import { Link } from 'react-router-dom';
import { Card, EmptyState } from '../components/ui';
import { IconHelp } from '../components/icons';

export function NotFound() {
  return (
    <Card className="mx-auto max-w-lg">
      <EmptyState
        icon={<IconHelp />}
        title="That screen does not exist"
        body="The address does not match any screen in this application."
        action={
          <Link
            to="/"
            className="inline-flex items-center rounded-lg bg-navy-600 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-navy-700"
          >
            Back to the overview
          </Link>
        }
      />
    </Card>
  );
}
