import { Rule } from '..';
import { getProblemList, Problem } from '../../../lib/problem';
import dedent from 'dedent';
import { fetchProblemLevel, ProblemLevelNameMap } from '../../../api/solvedac';
import { fetchProblemTitle } from '../../../api/baekjoon';
import { join, parse } from 'path';
import { exists } from '../../../lib/better-fs';
import { ROOT } from '../../../constants';

interface ProblemProps {
  problem: Problem;
  dateRowspan: number;
}

export const SolvedTableRule: Rule = {
  name: 'solved-table',
  type: 'root',
  isBlock: true,
  async execute(): Promise<string> {
    const problemList = await getProblemList({ sorted: true });
    const problemListClassified = Object.entries(
      problemList.reduce((acc, problem) => {
        const date = problem.meta.solvedDate ?? problem.meta.createDate;
        let update: ProblemProps[];
        if (date in acc) {
          const origin = acc[date];
          origin.push({ problem: problem, dateRowspan: 0 });
          origin[0].dateRowspan = origin.length;
          update = origin;
        } else {
          update = [{ problem, dateRowspan: 1 }];
        }
        return {
          ...acc,
          [date]: update,
        };
      }, {} as Record<string, ProblemProps[]>),
    )
      .sort(({ 0: leftDate }, { 0: rightDate }) =>
        leftDate.localeCompare(rightDate),
      )
      .map(({ 1: problemProps }) => problemProps)
      .flat();
    async function renderProblemLine({
      problem,
      dateRowspan: shouldAddDate,
    }: ProblemProps): Promise<string> {
      const { createDate, solvedDate } = problem.meta;
      const problemLevel = await fetchProblemLevel(problem.id);
      const problemTitle = await fetchProblemTitle(problem.id);
      function createSolutionLink(filename: string, ext: string): string {
        return `<a href="./${problem.id}/${filename}">풀이 (${ext})</a>`;
      }

      let solveCell: string;
      switch (problem.meta.status) {
        case 'solved': {
          const solution = await problem.getSolutionList();
          solveCell =
            solution
              .map((file) => createSolutionLink(file, parse(file).ext))
              .concat(
                (await exists(join(ROOT, problem.id.toString(), 'README.md')))
                  ? [`<a href="./${problem.id}/README.md">노트</a>`]
                  : [],
              )
              .join(', ') + (problem.isTimeout ? ` (→ ${createDate})` : '');
          break;
        }
        case 'in-progress': {
          solveCell = problem.isTimeout ? '타임아웃' : '푸는 중';
          break;
        }
      }

      return [
        '<tr>',
        shouldAddDate > 0
          ? `<td rowspan="${shouldAddDate}">${solvedDate ?? createDate}</td>`
          : '',
        dedent`
          <td>
            <a href="http://noj.am/${problem.id}">
              <img src="https://static.solved.ac/tier_small/${
                problemLevel.level
              }.svg" height="16px"/>
              ${ProblemLevelNameMap[problemLevel.level]}, ${
          problem.id
        } ${problemTitle}
            </a>
          </td>
        `,
        '<td>',
        solveCell,
        '</td>',
        '</tr>',
      ]
        .flat(Infinity)
        .filter(Boolean)
        .join('');
    }

    return dedent`
    <table>
      <tr>
        <th>날짜</th>
        <th>문제</th>
        <th>풀이</th>
      </tr>
    ${(await Promise.all(problemListClassified.map(renderProblemLine))).join(
      '\n',
    )}
    </table>
    `;
  },
};
